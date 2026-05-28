import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
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
import {
  clampAllFingerSlots,
  cloneFingerSlots,
  createDefaultFingerSlots,
  type FingerSlotsConfig,
} from "@/lib/finger-slots";
import {
  clampRampConfig,
  cloneRampConfig,
  createDefaultRampConfig,
  type RampConfig,
} from "@/lib/ramp-config";
import {
  createDefaultLayer,
  getActiveLayer,
  getAllPlacedModules,
  maxLayerCount,
  resolveLayerHeight,
  validateLayers,
  type ConfiguratorCoreState,
  type InsertLayer,
} from "@/lib/layer-utils";
import { deserializeConfig } from "@/lib/serialize-config";

export type { InsertLayer, ConfiguratorCoreState } from "@/lib/layer-utils";
export type ViewMode = "2d" | "3d";

export interface DragGhost {
  source: "library" | "canvas";
  moduleId: string;
  instanceId?: string;
  groupInstanceIds?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  inBounds: boolean;
  collides: boolean;
}

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
  fingerSlots: FingerSlotsConfig;
  rampConfig: RampConfig;
}

interface AddCustomInput extends ModuleEditValues {
  color?: string;
}

interface ConfiguratorState extends ConfiguratorCoreState {
  customModules: InsertModule[];
  viewMode: ViewMode;
  ghost: DragGhost | null;
  canvasDrag: CanvasDragSession | null;
  groupDragOrigins: Record<string, { x: number; y: number }> | null;
  selectedInstanceIds: string[];
  hoveredGroupId: string | null;
  selectedDivider: { instanceId: string; dividerId: string } | null;
  stackOverflow: boolean;
  hasDepthOverflow: boolean;
  overflowingLayerIds: string[];
  resolvedHeights: number[];
  stackHeight: number;
}

type ConfiguratorActions = {
  setViewMode: (m: ViewMode) => void;
  setBoxDimensions: (dims: Partial<{ width: number; height: number; depth: number }>) => void;
  setActiveLayerId: (id: string) => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  moveLayerUp: (id: string) => void;
  moveLayerDown: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerHeightMode: (id: string, mode: "auto" | "manual") => void;
  setLayerManualHeight: (id: string, height: number) => void;
  addCustomModule: (input: AddCustomInput) => InsertModule;
  updateCustomModule: (
    id: string,
    values: ModuleEditValues,
    options?: { propagateInstanceOverrides?: boolean },
  ) => void;
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
  /** Active layer modules (2D canvas scope). */
  placed: PlacedModule[];
  /** All modules across layers (3D / totals). */
  allPlaced: PlacedModule[];
};

export type ConfiguratorStore = ConfiguratorState & ConfiguratorActions;

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

function applyLayerValidation(state: ConfiguratorState): ConfiguratorState {
  const v = validateLayers(state.layers, state.boxDepth);
  return {
    ...state,
    layers: v.layers,
    stackOverflow: v.stackOverflow,
    hasDepthOverflow: v.hasDepthOverflow,
    overflowingLayerIds: [...v.overflowingLayerIds],
    resolvedHeights: v.resolvedHeights,
    stackHeight: v.stackHeight,
  };
}

function findLayerForInstance(state: ConfiguratorState, instanceId: string): string | null {
  for (const l of state.layers) {
    if (l.placedModules.some((p) => p.instanceId === instanceId)) return l.id;
  }
  return null;
}

const initialLayer = createDefaultLayer("Layer 1");

const initialState: ConfiguratorState = applyLayerValidation({
  layers: [initialLayer],
  activeLayerId: initialLayer.id,
  boxWidth: DEFAULT_BOX.width,
  boxHeight: DEFAULT_BOX.height,
  boxDepth: DEFAULT_BOX_DEPTH_MM,
  customModules: [],
  viewMode: "2d",
  ghost: null,
  canvasDrag: null,
  groupDragOrigins: null,
  selectedInstanceIds: [],
  hoveredGroupId: null,
  selectedDivider: null,
  stackOverflow: false,
  hasDepthOverflow: false,
  overflowingLayerIds: [],
  resolvedHeights: [0],
  stackHeight: 0,
});

type Action =
  | { type: "PATCH"; patch: Partial<ConfiguratorState> }
  | { type: "SET_LAYERS"; layers: InsertLayer[]; activeLayerId?: string };

function reducer(state: ConfiguratorState, action: Action): ConfiguratorState {
  switch (action.type) {
    case "PATCH":
      return applyLayerValidation({ ...state, ...action.patch });
    case "SET_LAYERS":
      return applyLayerValidation({
        ...state,
        layers: action.layers,
        activeLayerId: action.activeLayerId ?? state.activeLayerId,
      });
    default:
      return state;
  }
}

const ConfiguratorContext = createContext<ConfiguratorStore | null>(null);

let storeRef: ConfiguratorStore | null = null;

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sharedConfigLoaded = useRef(false);

  useEffect(() => {
    if (sharedConfigLoaded.current) return;
    sharedConfigLoaded.current = true;

    const encoded = new URLSearchParams(window.location.search).get("config");
    if (!encoded) return;

    const shared = deserializeConfig(encoded);
    if (!shared) return;

    for (const module of shared.customModules) {
      registerModule(module);
    }

    dispatch({
      type: "PATCH",
      patch: {
        boxWidth: shared.boxWidth,
        boxHeight: shared.boxHeight,
        boxDepth: shared.boxDepth,
        layers: shared.layers,
        activeLayerId: shared.activeLayerId,
        customModules: shared.customModules,
        selectedInstanceIds: [],
        selectedDivider: null,
        hoveredGroupId: null,
        ghost: null,
        canvasDrag: null,
        groupDragOrigins: null,
      },
    });
    toast.success("Configuration loaded from shared link ✓");
  }, []);

  const patch = useCallback((p: Partial<ConfiguratorState>) => {
    dispatch({ type: "PATCH", patch: p });
  }, []);

  const activePlaced = useMemo(
    () => getActiveLayer(state)?.placedModules ?? [],
    [state.layers, state.activeLayerId],
  );

  const allPlaced = useMemo(() => getAllPlacedModules(state.layers), [state.layers]);

  const actions: ConfiguratorActions = useMemo(
    () => ({
      setViewMode: (m) => patch({ viewMode: m }),

      setBoxDimensions: (dims) => {
        const boxWidth = dims.width !== undefined ? clampDim(dims.width) : state.boxWidth;
        const boxHeight = dims.height !== undefined ? clampDim(dims.height) : state.boxHeight;
        const boxDepth = dims.depth !== undefined ? clampDim(dims.depth) : state.boxDepth;
        const layers = state.layers.map((l) => ({
          ...l,
          placedModules: recompute(l.placedModules, boxWidth, boxHeight),
          manualHeight:
            l.heightMode === "manual" && l.manualHeight != null
              ? Math.min(Math.max(1, l.manualHeight), boxDepth)
              : l.manualHeight,
        }));
        patch({ boxWidth, boxHeight, boxDepth, layers });
      },

      setActiveLayerId: (id) => {
        if (!state.layers.some((l) => l.id === id)) return;
        patch({ activeLayerId: id, selectedInstanceIds: [], selectedDivider: null });
      },

      addLayer: () => {
        if (state.layers.length >= maxLayerCount(state.boxDepth)) return;
        const n = state.layers.length + 1;
        const layer = createDefaultLayer(`Layer ${n}`);
        patch({
          layers: [...state.layers, layer],
          activeLayerId: layer.id,
        });
      },

      removeLayer: (id) => {
        if (state.layers.length <= 1) return;
        const idx = state.layers.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const layers = state.layers.filter((l) => l.id !== id);
        let activeLayerId = state.activeLayerId;
        if (activeLayerId === id) {
          activeLayerId = layers[Math.min(idx, layers.length - 1)]!.id;
        }
        patch({
          layers,
          activeLayerId,
          selectedInstanceIds: [],
          selectedDivider: null,
        });
      },

      moveLayerUp: (id) => {
        const idx = state.layers.findIndex((l) => l.id === id);
        if (idx <= 0) return;
        const layers = [...state.layers];
        [layers[idx - 1], layers[idx]] = [layers[idx]!, layers[idx - 1]!];
        patch({ layers });
      },

      moveLayerDown: (id) => {
        const idx = state.layers.findIndex((l) => l.id === id);
        if (idx < 0 || idx >= state.layers.length - 1) return;
        const layers = [...state.layers];
        [layers[idx], layers[idx + 1]] = [layers[idx + 1]!, layers[idx]!];
        patch({ layers });
      },

      renameLayer: (id, name) => {
        patch({
          layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
        });
      },

      setLayerHeightMode: (id, mode) => {
        patch({
          layers: state.layers.map((l) => {
            if (l.id !== id) return l;
            if (mode === "auto") {
              return { ...l, heightMode: "auto", manualHeight: null };
            }
            const h = resolveLayerHeight(l) || Math.min(40, state.boxDepth);
            return { ...l, heightMode: "manual", manualHeight: h };
          }),
        });
      },

      setLayerManualHeight: (id, height) => {
        const clamped = Math.min(Math.max(1, roundDim(height)), state.boxDepth);
        patch({
          layers: state.layers.map((l) => (l.id === id ? { ...l, manualHeight: clamped } : l)),
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
          color: input.color ?? COLOR_FALLBACK,
          type: "custom",
          fingerSlots: clampAllFingerSlots(
            input.fingerSlots ?? createDefaultFingerSlots(),
            input.width,
            input.height,
            input.depth,
          ),
          rampConfig: clampRampConfig(
            input.rampConfig ?? createDefaultRampConfig(),
            input.depth,
            wallThickness,
          ),
        };
        registerModule(m);
        patch({ customModules: [...state.customModules, m] });
        return m;
      },

      updateCustomModule: (id, values, options) => {
        const existing = getModule(id);
        const updated: InsertModule = {
          ...existing,
          name: values.name,
          width: values.width,
          height: values.height,
          depth: values.depth,
          wallThickness: values.wallThickness,
          fingerSlots: clampAllFingerSlots(
            values.fingerSlots,
            values.width,
            values.height,
            values.depth,
          ),
          rampConfig: clampRampConfig(values.rampConfig, values.depth, values.wallThickness),
        };
        registerModule(updated);
        const propagateInstanceOverrides = options?.propagateInstanceOverrides !== false;
        const layers = state.layers.map((l) => ({
          ...l,
          placedModules: recompute(
            l.placedModules.map((p) => {
              if (p.moduleId !== id) return p;
              const { w, h } = getRotatedSize(updated, p.rotation);
              const { x, y } = clampToBox(p.x, p.y, w, h, state.boxWidth, state.boxHeight);
              return {
                ...p,
                x,
                y,
                ...(propagateInstanceOverrides
                  ? {
                      fingerSlots: cloneFingerSlots(updated.fingerSlots!),
                      rampConfig: cloneRampConfig(updated.rampConfig!),
                    }
                  : {}),
              };
            }),
            state.boxWidth,
            state.boxHeight,
          ),
        }));
        patch({
          customModules: state.customModules.map((m) => (m.id === id ? updated : m)),
          layers,
        });
      },

      editPlacedModule: (instanceId, values) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const placed = state.layers
          .flatMap((l) => l.placedModules)
          .find((p) => p.instanceId === instanceId);
        if (!placed) return;
        const existing = getModule(placed.moduleId);

        if (existing.type === "custom") {
          const updated: InsertModule = {
            ...existing,
            name: values.name,
            width: values.width,
            height: values.height,
            depth: values.depth,
            wallThickness: values.wallThickness,
            fingerSlots: clampAllFingerSlots(
              values.fingerSlots,
              values.width,
              values.height,
              values.depth,
            ),
            rampConfig: clampRampConfig(values.rampConfig, values.depth, values.wallThickness),
          };
          registerModule(updated);
          const layers = state.layers.map((l) => ({
            ...l,
            placedModules: recompute(
              l.placedModules.map((p) => {
                if (p.instanceId === instanceId) {
                  return {
                    ...p,
                    fingerSlots: cloneFingerSlots(values.fingerSlots),
                    rampConfig: cloneRampConfig(
                      clampRampConfig(values.rampConfig, values.depth, values.wallThickness),
                    ),
                  };
                }
                if (p.moduleId !== existing.id) return p;
                const { w, h } = getRotatedSize(updated, p.rotation);
                const { x, y } = clampToBox(p.x, p.y, w, h, state.boxWidth, state.boxHeight);
                return { ...p, x, y };
              }),
              state.boxWidth,
              state.boxHeight,
            ),
          }));
          patch({
            customModules: state.customModules.map((m) => (m.id === existing.id ? updated : m)),
            layers,
          });
          return;
        }

        const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        const wallThickness = values.wallThickness ?? DEFAULT_WALL_MM;
        const variant: InsertModule = {
          id,
          name: values.name,
          width: values.width,
          height: values.height,
          depth: values.depth,
          wallThickness,
          color: existing.color,
          type: "custom",
          fingerSlots: clampAllFingerSlots(
            values.fingerSlots,
            values.width,
            values.height,
            values.depth,
          ),
          rampConfig: clampRampConfig(values.rampConfig, values.depth, wallThickness),
        };
        registerModule(variant);
        patch({ customModules: [...state.customModules, variant] });
        const { w, h } = getRotatedSize(variant, placed.rotation);
        const { x, y } = clampToBox(placed.x, placed.y, w, h, state.boxWidth, state.boxHeight);
        const layers = state.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                placedModules: recompute(
                  l.placedModules.map((p) =>
                    p.instanceId === instanceId
                      ? {
                          ...p,
                          moduleId: variant.id,
                          x,
                          y,
                          fingerSlots: cloneFingerSlots(values.fingerSlots),
                          rampConfig: cloneRampConfig(
                            clampRampConfig(values.rampConfig, values.depth, values.wallThickness),
                          ),
                        }
                      : p,
                  ),
                  state.boxWidth,
                  state.boxHeight,
                ),
              }
            : l,
        );
        patch({ layers });
      },

      addModule: (moduleId, xMm, yMm) => {
        const m = getModule(moduleId);
        const { w, h } = getRotatedSize(m, 0);
        const { x, y } = clampToBox(
          xMm - w / 2,
          yMm - h / 2,
          w,
          h,
          state.boxWidth,
          state.boxHeight,
        );
        const next: PlacedModule = {
          instanceId: `${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          moduleId,
          x,
          y,
          rotation: 0,
          isOverlapping: false,
          isOutOfBounds: false,
          fingerSlots: cloneFingerSlots(m.fingerSlots ?? createDefaultFingerSlots()),
          rampConfig: cloneRampConfig(m.rampConfig ?? createDefaultRampConfig()),
        };
        const layers = state.layers.map((l) =>
          l.id === state.activeLayerId
            ? {
                ...l,
                placedModules: recompute(
                  [...l.placedModules, next],
                  state.boxWidth,
                  state.boxHeight,
                ),
              }
            : l,
        );
        patch({ layers });
      },

      moveModule: (instanceId, xMm, yMm, dragOrigins) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layer = state.layers.find((l) => l.id === layerId)!;
        const p = layer.placedModules.find((pp) => pp.instanceId === instanceId);
        if (!p) return;
        const m = getModule(p.moduleId);
        const { w, h } = getRotatedSize(m, p.rotation);
        const moveIds =
          p.groupId != null ? getGroupMemberIds(layer.placedModules, p.groupId) : [instanceId];
        const origins = dragOrigins ?? state.groupDragOrigins;
        const origin = origins?.[instanceId] ?? { x: p.x, y: p.y };
        let dx = xMm - origin.x;
        let dy = yMm - origin.y;

        if (p.groupId) {
          ({ dx, dy } = clampGroupMove(
            layer.placedModules,
            p.groupId,
            dx,
            dy,
            state.boxWidth,
            state.boxHeight,
          ));
        } else {
          const clamped = clampToBox(xMm, yMm, w, h, state.boxWidth, state.boxHeight);
          dx = clamped.x - origin.x;
          dy = clamped.y - origin.y;
        }

        const cx = origin.x + dx + w / 2;
        const cy = origin.y + dy + h / 2;
        if (cx < -10 || cy < -10 || cx > state.boxWidth + 10 || cy > state.boxHeight + 10) {
          const layers = state.layers.map((l) =>
            l.id === layerId
              ? {
                  ...l,
                  placedModules: recompute(
                    l.placedModules.filter((pp) => !moveIds.includes(pp.instanceId)),
                    state.boxWidth,
                    state.boxHeight,
                  ),
                }
              : l,
          );
          patch({
            layers,
            selectedInstanceIds: state.selectedInstanceIds.filter((id) => !moveIds.includes(id)),
            ghost: null,
            canvasDrag: null,
            groupDragOrigins: null,
          });
          return;
        }

        const layers = state.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                placedModules: recompute(
                  l.placedModules.map((pp) => {
                    if (!moveIds.includes(pp.instanceId)) return pp;
                    const base = origins?.[pp.instanceId] ?? { x: pp.x, y: pp.y };
                    return { ...pp, x: roundDim(base.x + dx), y: roundDim(base.y + dy) };
                  }),
                  state.boxWidth,
                  state.boxHeight,
                ),
              }
            : l,
        );
        patch({ layers, ghost: null, canvasDrag: null, groupDragOrigins: null });
      },

      rotateModule: (instanceId) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layers = state.layers.map((l) => {
          if (l.id !== layerId) return l;
          const target = l.placedModules.find((p) => p.instanceId === instanceId);
          if (!target || target.groupId) return l;
          return {
            ...l,
            placedModules: recompute(
              l.placedModules.map((p) => {
                if (p.instanceId !== instanceId) return p;
                const newRot = ((p.rotation + 90) % 360) as 0 | 90 | 180 | 270;
                const mod = getModule(p.moduleId);
                const { w, h } = getRotatedSize(mod, newRot);
                const { x, y } = clampToBox(p.x, p.y, w, h, state.boxWidth, state.boxHeight);
                return { ...p, rotation: newRot, x, y };
              }),
              state.boxWidth,
              state.boxHeight,
            ),
          };
        });
        patch({ layers });
      },

      removeModule: (instanceId) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layer = state.layers.find((l) => l.id === layerId)!;
        const target = layer.placedModules.find((p) => p.instanceId === instanceId);
        const removeIds =
          target?.groupId != null
            ? getGroupMemberIds(layer.placedModules, target.groupId)
            : [instanceId];
        const layers = state.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                placedModules: recompute(
                  l.placedModules.filter((p) => !removeIds.includes(p.instanceId)),
                  state.boxWidth,
                  state.boxHeight,
                ),
              }
            : l,
        );
        patch({
          layers,
          selectedInstanceIds: state.selectedInstanceIds.filter((id) => !removeIds.includes(id)),
        });
      },

      setGhost: (g) => patch({ ghost: g }),
      setCanvasDrag: (session) =>
        patch({ canvasDrag: session, groupDragOrigins: session?.origins ?? null }),
      setGroupDragOrigins: (origins) => patch({ groupDragOrigins: origins }),
      clearDragState: () => patch({ ghost: null, canvasDrag: null, groupDragOrigins: null }),

      toggleSelection: (instanceId) => {
        const has = state.selectedInstanceIds.includes(instanceId);
        patch({
          selectedInstanceIds: has
            ? state.selectedInstanceIds.filter((id) => id !== instanceId)
            : [...state.selectedInstanceIds, instanceId],
        });
      },

      selectSingle: (instanceId) => patch({ selectedInstanceIds: [instanceId] }),
      clearSelection: () => patch({ selectedInstanceIds: [], selectedDivider: null }),

      mergeSelected: () => {
        const active = getActiveLayer(state);
        if (!active) return { ok: false, error: "No active layer" };
        const result = mergeModules(active.placedModules, state.selectedInstanceIds);
        if ("error" in result) return { ok: false, error: result.error };
        const layers = state.layers.map((l) =>
          l.id === state.activeLayerId
            ? {
                ...l,
                placedModules: recompute(result.placed, state.boxWidth, state.boxHeight),
              }
            : l,
        );
        const merged = layers.find((l) => l.id === state.activeLayerId)!;
        patch({
          layers,
          selectedInstanceIds: getGroupMemberIds(merged.placedModules, result.groupId),
          ghost: null,
          canvasDrag: null,
          groupDragOrigins: null,
        });
        return { ok: true };
      },

      unmergeGroup: (groupId) => {
        const layers = state.layers.map((l) => ({
          ...l,
          placedModules: l.placedModules.map((p) =>
            p.groupId === groupId ? { ...p, groupId: undefined } : p,
          ),
        }));
        patch({
          layers,
          hoveredGroupId: state.hoveredGroupId === groupId ? null : state.hoveredGroupId,
          ghost: null,
          canvasDrag: null,
          groupDragOrigins: null,
        });
      },

      setHoveredGroupId: (groupId) => patch({ hoveredGroupId: groupId }),

      addDivider: (instanceId, orientation) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layers = state.layers.map((l) => {
          if (l.id !== layerId) return l;
          const placed = l.placedModules.find((p) => p.instanceId === instanceId);
          if (!placed) return l;
          const divider = createDivider(placed, orientation);
          return {
            ...l,
            placedModules: l.placedModules.map((p) =>
              p.instanceId === instanceId
                ? { ...p, dividers: [...(p.dividers ?? []), divider] }
                : p,
            ),
          };
        });
        const divider = layers
          .flatMap((l) => l.placedModules)
          .find((p) => p.instanceId === instanceId)
          ?.dividers?.at(-1);
        patch({
          layers,
          selectedDivider: divider ? { instanceId, dividerId: divider.id } : state.selectedDivider,
        });
      },

      updateDivider: (instanceId, dividerId, patchDiv) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layers = state.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            placedModules: l.placedModules.map((p) => {
              if (p.instanceId !== instanceId) return p;
              const m = getModule(p.moduleId);
              const wallT = getModuleWallThickness(p);
              return {
                ...p,
                dividers: (p.dividers ?? []).map((d) => {
                  if (d.id !== dividerId) return d;
                  let position = d.position;
                  let height = d.height;
                  if (patchDiv.position !== undefined) {
                    position = clampDividerPosition(
                      d.orientation,
                      patchDiv.position,
                      m.width,
                      m.height,
                      wallT,
                    );
                  }
                  if (patchDiv.height !== undefined) {
                    height = clampDividerHeight(patchDiv.height, m.depth, wallT);
                  }
                  return { ...d, position, height };
                }),
              };
            }),
          };
        });
        patch({ layers });
      },

      removeDivider: (instanceId, dividerId) => {
        const layerId = findLayerForInstance(state, instanceId);
        if (!layerId) return;
        const layers = state.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            placedModules: l.placedModules.map((p) =>
              p.instanceId === instanceId
                ? { ...p, dividers: (p.dividers ?? []).filter((d) => d.id !== dividerId) }
                : p,
            ),
          };
        });
        patch({
          layers,
          selectedDivider:
            state.selectedDivider?.instanceId === instanceId &&
            state.selectedDivider.dividerId === dividerId
              ? null
              : state.selectedDivider,
        });
      },

      setSelectedDivider: (sel) => patch({ selectedDivider: sel }),

      recomputeOverlaps: () => {
        const layers = state.layers.map((l) => ({
          ...l,
          placedModules: recompute(l.placedModules, state.boxWidth, state.boxHeight),
        }));
        patch({ layers });
      },

      autoPack: () => {
        const active = getActiveLayer(state);
        if (!active || active.placedModules.length === 0) return { unpackedCount: 0 };
        const { placed, unpacked } = runAutoPack(
          active.placedModules,
          state.boxWidth,
          state.boxHeight,
        );
        const layers = state.layers.map((l) =>
          l.id === state.activeLayerId
            ? {
                ...l,
                placedModules: recompute(placed, state.boxWidth, state.boxHeight),
              }
            : l,
        );
        patch({ layers });
        return { unpackedCount: unpacked.length };
      },

      placed: activePlaced,
      allPlaced: allPlaced,
    }),
    [state, patch, activePlaced, allPlaced],
  );

  const store = useMemo((): ConfiguratorStore => ({ ...state, ...actions }), [state, actions]);

  const storeRefLocal = useRef(store);
  storeRefLocal.current = store;
  storeRef = store;

  return <ConfiguratorContext.Provider value={store}>{children}</ConfiguratorContext.Provider>;
}

export function useConfigurator<T>(selector: (s: ConfiguratorStore) => T): T {
  const store = useContext(ConfiguratorContext);
  if (!store) {
    throw new Error("useConfigurator must be used within ConfiguratorProvider");
  }
  return selector(store);
}

useConfigurator.getState = (): ConfiguratorStore => {
  if (!storeRef) {
    throw new Error("Configurator store not initialized");
  }
  return storeRef;
};

export const selectAllModules = (s: ConfiguratorStore): InsertModule[] => [
  ...BUILTIN_MODULES,
  ...s.customModules,
];

export { GRID_MM, SNAP_MM, MIN_BOX_MM, MAX_BOX_MM };
