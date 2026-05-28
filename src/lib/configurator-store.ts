import { create } from "zustand";
import {
  BOX,
  BUILTIN_MODULES,
  DEFAULT_BOX,
  DEFAULT_BOX_DEPTH_MM,
  DEFAULT_WALL_MM,
  GRID_MM,
  MAX_BOX_MM,
  MIN_BOX_MM,
  roundDim,
  SNAP_MM,
  getModule,
  getRotatedSize,
  priceFromVolume,
  registerModule,
  snap,
  type InsertModule,
  type ModuleDivider,
  type PlacedModule,
} from "@/lib/insert-types";
import { autoPack as runAutoPack } from "@/lib/auto-pack";
import {
  clampDividerHeight,
  clampDividerPosition,
  createDivider,
  getModuleWallThickness,
} from "@/lib/module-dividers";
import { getGroupBounds, getGroupMemberIds, mergeModules } from "@/lib/merge-groups";

export type ViewMode = "2d" | "3d";

export interface DragGhost {
  source: "library" | "canvas";
  moduleId: string;
  instanceId?: string;
  /** All instance ids moving together (includes the dragged module). */
  groupInstanceIds?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  inBounds: boolean;
  collides: boolean;
}

/** Live canvas drag — single atomic state for group moves. */
export interface CanvasDragSession {
  leadInstanceId: string;
  memberInstanceIds: string[];
  origins: Record<string, { x: number; y: number }>;
  leadX: number;
  leadY: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  inBounds: boolean;
  collides: boolean;
}

export interface ModuleEditValues {
  name: string;
  width: number;
  height: number;
  depth: number;
  wallThickness: number;
}

interface AddCustomInput extends ModuleEditValues {
  color?: string;
}

interface ConfiguratorState {
  placed: PlacedModule[];
  customModules: InsertModule[];
  viewMode: ViewMode;
  ghost: DragGhost | null;
  canvasDrag: CanvasDragSession | null;
  /** @deprecated Use canvasDrag.origins during an active canvas drag. */
  groupDragOrigins: Record<string, { x: number; y: number }> | null;
  selectedInstanceIds: string[];
  hoveredGroupId: string | null;
  selectedDivider: { instanceId: string; dividerId: string } | null;
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  setViewMode: (m: ViewMode) => void;
  setBoxDimensions: (dims: Partial<{ width: number; height: number; depth: number }>) => void;
  addCustomModule: (input: AddCustomInput) => InsertModule;
  updateCustomModule: (id: string, values: ModuleEditValues) => void;
  editPlacedModule: (instanceId: string, values: ModuleEditValues) => void;
  addModule: (moduleId: string, xMm: number, yMm: number) => void;
  moveModule: (
    instanceId: string,
    xMm: number,
    yMm: number,
    dragOrigins?: Record<string, { x: number; y: number }> | null,
  ) => void;
  rotateModule: (instanceId: string) => void;
  removeModule: (instanceId: string) => void;
  setGhost: (g: DragGhost | null) => void;
  setCanvasDrag: (session: CanvasDragSession | null) => void;
  setGroupDragOrigins: (origins: Record<string, { x: number; y: number }> | null) => void;
  clearDragState: () => void;
  toggleSelection: (instanceId: string) => void;
  selectSingle: (instanceId: string) => void;
  clearSelection: () => void;
  mergeSelected: () => { ok: boolean; error?: string };
  unmergeGroup: (groupId: string) => void;
  setHoveredGroupId: (groupId: string | null) => void;
  addDivider: (instanceId: string, orientation: ModuleDivider["orientation"]) => void;
  updateDivider: (
    instanceId: string,
    dividerId: string,
    patch: Partial<Pick<ModuleDivider, "position" | "height">>,
  ) => void;
  removeDivider: (instanceId: string, dividerId: string) => void;
  setSelectedDivider: (sel: { instanceId: string; dividerId: string } | null) => void;
  recomputeOverlaps: () => void;
  autoPack: () => { unpackedCount: number };
}

/** Clamp a top-left mm coordinate into a box of the given dimensions. */
export function clampToBox(
  x: number,
  y: number,
  w: number,
  h: number,
  boxW: number = BOX.width,
  boxH: number = BOX.height,
) {
  const nx = Math.min(Math.max(0, snap(x)), Math.max(0, boxW - w));
  const ny = Math.min(Math.max(0, snap(y)), Math.max(0, boxH - h));
  return { x: nx, y: ny };
}

export function rectsCollide(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when two placed modules intentionally share walls (same group). */
export function sameGroup(a: PlacedModule, b: PlacedModule): boolean {
  return !!a.groupId && a.groupId === b.groupId;
}

function recompute(placed: PlacedModule[], boxW: number, boxH: number): PlacedModule[] {
  const rects = placed.map((p) => {
    const m = getModule(p.moduleId);
    const { w, h } = getRotatedSize(m, p.rotation);
    return { x: p.x, y: p.y, w, h };
  });
  const overlap = new Array(placed.length).fill(false);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (sameGroup(placed[i], placed[j])) continue;
      if (rectsCollide(rects[i], rects[j])) {
        overlap[i] = true;
        overlap[j] = true;
      }
    }
  }
  return placed.map((p, i) => {
    const r = rects[i];
    const outOfBounds = r.x < 0 || r.y < 0 || r.x + r.w > boxW || r.y + r.h > boxH;
    return { ...p, isOverlapping: overlap[i], isOutOfBounds: outOfBounds };
  });
}

/** Clamp a rigid group so its bounding box stays inside the workspace. */
function clampGroupMove(
  placed: PlacedModule[],
  groupId: string,
  dx: number,
  dy: number,
  boxW: number,
  boxH: number,
): { dx: number; dy: number } {
  const bounds = getGroupBounds(placed, groupId);
  if (!bounds) return { dx, dy };

  let ndx = dx;
  let ndy = dy;
  if (bounds.x + ndx < 0) ndx = -bounds.x;
  if (bounds.y + ndy < 0) ndy = -bounds.y;
  if (bounds.x + bounds.w + ndx > boxW) ndx = boxW - bounds.x - bounds.w;
  if (bounds.y + bounds.h + ndy > boxH) ndy = boxH - bounds.y - bounds.h;

  return { dx: roundDim(ndx), dy: roundDim(ndy) };
}

const COLOR_FALLBACK = "#a78bfa";
const clampDim = (v: number) => Math.max(MIN_BOX_MM, Math.min(MAX_BOX_MM, roundDim(v)));

export const useConfigurator = create<ConfiguratorState>((set, get) => ({
  placed: [],
  customModules: [],
  viewMode: "2d",
  ghost: null,
  canvasDrag: null,
  groupDragOrigins: null,
  selectedInstanceIds: [],
  hoveredGroupId: null,
  selectedDivider: null,
  boxWidth: DEFAULT_BOX.width,
  boxHeight: DEFAULT_BOX.height,
  boxDepth: DEFAULT_BOX_DEPTH_MM,

  setViewMode: (m) => set({ viewMode: m }),

  setBoxDimensions: (dims) => {
    const s = get();
    const boxWidth = dims.width !== undefined ? clampDim(dims.width) : s.boxWidth;
    const boxHeight = dims.height !== undefined ? clampDim(dims.height) : s.boxHeight;
    const boxDepth = dims.depth !== undefined ? clampDim(dims.depth) : s.boxDepth;
    set({
      boxWidth,
      boxHeight,
      boxDepth,
      placed: recompute(s.placed, boxWidth, boxHeight),
    });
  },

  addCustomModule: (input) => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const wallThickness = input.wallThickness ?? DEFAULT_WALL_MM;
    const m: InsertModule = {
      id,
      name: input.name,
      width: input.width,
      height: input.height,
      depth: input.depth,
      wallThickness,
      price: priceFromVolume(input.width, input.height, input.depth, wallThickness),
      color: input.color ?? COLOR_FALLBACK,
      type: "custom",
    };
    registerModule(m);
    set({ customModules: [...get().customModules, m] });
    return m;
  },

  updateCustomModule: (id, values) => {
    const s = get();
    const existing = getModule(id);
    const updated: InsertModule = {
      ...existing,
      name: values.name,
      width: values.width,
      height: values.height,
      depth: values.depth,
      wallThickness: values.wallThickness,
      price: priceFromVolume(values.width, values.height, values.depth, values.wallThickness),
    };
    registerModule(updated);
    set({
      customModules: s.customModules.map((m) => (m.id === id ? updated : m)),
      placed: recompute(
        s.placed.map((p) => {
          if (p.moduleId !== id) return p;
          const { w, h } = getRotatedSize(updated, p.rotation);
          const { x, y } = clampToBox(p.x, p.y, w, h, s.boxWidth, s.boxHeight);
          return { ...p, x, y };
        }),
        s.boxWidth,
        s.boxHeight,
      ),
    });
  },

  editPlacedModule: (instanceId, values) => {
    const s = get();
    const placed = s.placed.find((p) => p.instanceId === instanceId);
    if (!placed) return;
    const existing = getModule(placed.moduleId);

    if (existing.type === "custom") {
      get().updateCustomModule(existing.id, values);
      return;
    }

    const variant = get().addCustomModule({ ...values, color: existing.color });
    const { w, h } = getRotatedSize(variant, placed.rotation);
    const { x, y } = clampToBox(placed.x, placed.y, w, h, s.boxWidth, s.boxHeight);
    set({
      placed: recompute(
        get().placed.map((p) =>
          p.instanceId === instanceId ? { ...p, moduleId: variant.id, x, y } : p,
        ),
        s.boxWidth,
        s.boxHeight,
      ),
    });
  },

  addModule: (moduleId, xMm, yMm) => {
    const s = get();
    const m = getModule(moduleId);
    const { w, h } = getRotatedSize(m, 0);
    const { x, y } = clampToBox(xMm - w / 2, yMm - h / 2, w, h, s.boxWidth, s.boxHeight);
    const next: PlacedModule = {
      instanceId: `${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      moduleId,
      x,
      y,
      rotation: 0,
      isOverlapping: false,
      isOutOfBounds: false,
    };
    set({ placed: recompute([...s.placed, next], s.boxWidth, s.boxHeight) });
  },

  moveModule: (instanceId, xMm, yMm, dragOrigins) => {
    const s = get();
    const p = s.placed.find((p) => p.instanceId === instanceId);
    if (!p) return;
    const m = getModule(p.moduleId);
    const { w, h } = getRotatedSize(m, p.rotation);

    const moveIds = p.groupId != null ? getGroupMemberIds(s.placed, p.groupId) : [instanceId];

    const origins = dragOrigins ?? s.groupDragOrigins;
    const origin = origins?.[instanceId] ?? { x: p.x, y: p.y };
    let dx = xMm - origin.x;
    let dy = yMm - origin.y;

    if (p.groupId) {
      ({ dx, dy } = clampGroupMove(s.placed, p.groupId, dx, dy, s.boxWidth, s.boxHeight));
    } else {
      const clamped = clampToBox(xMm, yMm, w, h, s.boxWidth, s.boxHeight);
      dx = clamped.x - origin.x;
      dy = clamped.y - origin.y;
    }

    const cx = origin.x + dx + w / 2;
    const cy = origin.y + dy + h / 2;
    if (cx < -10 || cy < -10 || cx > s.boxWidth + 10 || cy > s.boxHeight + 10) {
      set({
        placed: recompute(
          s.placed.filter((pp) => !moveIds.includes(pp.instanceId)),
          s.boxWidth,
          s.boxHeight,
        ),
        selectedInstanceIds: s.selectedInstanceIds.filter((id) => !moveIds.includes(id)),
        ghost: null,
        canvasDrag: null,
        groupDragOrigins: null,
      });
      return;
    }

    set({
      placed: recompute(
        s.placed.map((pp) => {
          if (!moveIds.includes(pp.instanceId)) return pp;
          const base = origins?.[pp.instanceId] ?? { x: pp.x, y: pp.y };
          return { ...pp, x: roundDim(base.x + dx), y: roundDim(base.y + dy) };
        }),
        s.boxWidth,
        s.boxHeight,
      ),
      ghost: null,
      canvasDrag: null,
      groupDragOrigins: null,
    });
  },

  rotateModule: (instanceId) => {
    const s = get();
    const target = s.placed.find((p) => p.instanceId === instanceId);
    if (!target || target.groupId) return;

    const updated = s.placed.map((p) => {
      if (p.instanceId !== instanceId) return p;
      const newRot = ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270;
      const m = getModule(p.moduleId);
      const { w, h } = getRotatedSize(m, newRot);
      const { x, y } = clampToBox(p.x, p.y, w, h, s.boxWidth, s.boxHeight);
      return { ...p, rotation: newRot, x, y };
    });
    set({ placed: recompute(updated, s.boxWidth, s.boxHeight) });
  },

  removeModule: (instanceId) => {
    const s = get();
    const target = s.placed.find((p) => p.instanceId === instanceId);
    const removeIds =
      target?.groupId != null ? getGroupMemberIds(s.placed, target.groupId) : [instanceId];
    set({
      placed: recompute(
        s.placed.filter((p) => !removeIds.includes(p.instanceId)),
        s.boxWidth,
        s.boxHeight,
      ),
      selectedInstanceIds: s.selectedInstanceIds.filter((id) => !removeIds.includes(id)),
    });
  },

  setGhost: (g) => set({ ghost: g }),
  setCanvasDrag: (session) =>
    set({
      canvasDrag: session,
      groupDragOrigins: session?.origins ?? null,
    }),
  setGroupDragOrigins: (origins) => set({ groupDragOrigins: origins }),
  clearDragState: () => set({ ghost: null, canvasDrag: null, groupDragOrigins: null }),

  toggleSelection: (instanceId) => {
    const s = get();
    const has = s.selectedInstanceIds.includes(instanceId);
    set({
      selectedInstanceIds: has
        ? s.selectedInstanceIds.filter((id) => id !== instanceId)
        : [...s.selectedInstanceIds, instanceId],
    });
  },

  selectSingle: (instanceId) => set({ selectedInstanceIds: [instanceId] }),

  clearSelection: () => set({ selectedInstanceIds: [], selectedDivider: null }),

  mergeSelected: () => {
    const s = get();
    const result = mergeModules(s.placed, s.selectedInstanceIds);
    if ("error" in result) return { ok: false, error: result.error };

    set({
      placed: recompute(result.placed, s.boxWidth, s.boxHeight),
      selectedInstanceIds: getGroupMemberIds(result.placed, result.groupId),
      ghost: null,
      canvasDrag: null,
      groupDragOrigins: null,
    });
    return { ok: true };
  },

  unmergeGroup: (groupId) => {
    const s = get();
    set({
      placed: s.placed.map((p) => (p.groupId === groupId ? { ...p, groupId: undefined } : p)),
      hoveredGroupId: s.hoveredGroupId === groupId ? null : s.hoveredGroupId,
      ghost: null,
      canvasDrag: null,
      groupDragOrigins: null,
    });
  },

  setHoveredGroupId: (groupId) => set({ hoveredGroupId: groupId }),

  addDivider: (instanceId, orientation) => {
    const s = get();
    const placed = s.placed.find((p) => p.instanceId === instanceId);
    if (!placed) return;
    const divider = createDivider(placed, orientation);
    set({
      placed: s.placed.map((p) =>
        p.instanceId === instanceId ? { ...p, dividers: [...(p.dividers ?? []), divider] } : p,
      ),
      selectedDivider: { instanceId, dividerId: divider.id },
    });
  },

  updateDivider: (instanceId, dividerId, patch) => {
    const s = get();
    const placed = s.placed.find((p) => p.instanceId === instanceId);
    if (!placed) return;
    const m = getModule(placed.moduleId);
    const wallT = getModuleWallThickness(placed);

    set({
      placed: s.placed.map((p) => {
        if (p.instanceId !== instanceId) return p;
        return {
          ...p,
          dividers: (p.dividers ?? []).map((d) => {
            if (d.id !== dividerId) return d;
            let position = d.position;
            let height = d.height;
            if (patch.position !== undefined) {
              position = clampDividerPosition(
                d.orientation,
                patch.position,
                m.width,
                m.height,
                wallT,
              );
            }
            if (patch.height !== undefined) {
              height = clampDividerHeight(patch.height, m.depth, wallT);
            }
            return { ...d, position, height };
          }),
        };
      }),
    });
  },

  removeDivider: (instanceId, dividerId) => {
    const s = get();
    set({
      placed: s.placed.map((p) =>
        p.instanceId === instanceId
          ? { ...p, dividers: (p.dividers ?? []).filter((d) => d.id !== dividerId) }
          : p,
      ),
      selectedDivider:
        s.selectedDivider?.instanceId === instanceId && s.selectedDivider.dividerId === dividerId
          ? null
          : s.selectedDivider,
    });
  },

  setSelectedDivider: (sel) => set({ selectedDivider: sel }),

  recomputeOverlaps: () => {
    const s = get();
    set({ placed: recompute(s.placed, s.boxWidth, s.boxHeight) });
  },

  autoPack: () => {
    const s = get();
    if (s.placed.length === 0) return { unpackedCount: 0 };
    const { placed, unpacked } = runAutoPack(s.placed, s.boxWidth, s.boxHeight);
    set({ placed: recompute(placed, s.boxWidth, s.boxHeight) });
    return { unpackedCount: unpacked.length };
  },
}));

export const selectAllModules = (s: ConfiguratorState): InsertModule[] => [
  ...BUILTIN_MODULES,
  ...s.customModules,
];

export { GRID_MM, SNAP_MM, MIN_BOX_MM, MAX_BOX_MM };
