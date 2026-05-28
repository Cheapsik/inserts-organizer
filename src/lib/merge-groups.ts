import { getModule, getRotatedSize, roundDim, type PlacedModule } from "@/lib/insert-types";

export const ADJACENCY_TOLERANCE_MM = 5;

export interface ModuleRect {
  placed: PlacedModule;
  x: number;
  y: number;
  w: number;
  h: number;
  wall: number;
}

export type AdjacencyEdge = "right" | "left" | "below" | "above";

export function getWallThickness(p: PlacedModule): number {
  const m = getModule(p.moduleId);
  return p.wallThickness ?? m.wallThickness;
}

export function toModuleRect(p: PlacedModule): ModuleRect {
  const m = getModule(p.moduleId);
  const { w, h } = getRotatedSize(m, p.rotation);
  return { placed: p, x: p.x, y: p.y, w, h, wall: getWallThickness(p) };
}

/** Shared wall overlap when gluing two modules (mm). */
export function jointWallOverlap(wallA: number, wallB: number): number {
  return roundDim((wallA + wallB) / 2);
}

function spansOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

/**
 * Detect whether `b` is adjacent (or nearly adjacent) to `a` on a shared edge.
 * Returns the edge of `a` that `b` touches.
 */
export function findAdjacency(
  a: ModuleRect,
  b: ModuleRect,
  tolerance = ADJACENCY_TOLERANCE_MM,
): AdjacencyEdge | null {
  const yAligned = spansOverlap(a.y, a.y + a.h, b.y, b.y + b.h);
  const xAligned = spansOverlap(a.x, a.x + a.w, b.x, b.x + b.w);

  const gapRight = b.x - (a.x + a.w);
  if (yAligned && Math.abs(gapRight) <= tolerance) return "right";

  const gapLeft = a.x - (b.x + b.w);
  if (yAligned && Math.abs(gapLeft) <= tolerance) return "left";

  const gapBelow = b.y - (a.y + a.h);
  if (xAligned && Math.abs(gapBelow) <= tolerance) return "below";

  const gapAbove = a.y - (b.y + b.h);
  if (xAligned && Math.abs(gapAbove) <= tolerance) return "above";

  return null;
}

/** Snap `target` against `anchor` so their shared wall overlaps by joint thickness. */
export function snapWithWallOverlap(
  anchor: ModuleRect,
  target: ModuleRect,
  edge: AdjacencyEdge,
): { x: number; y: number } {
  const overlap = jointWallOverlap(anchor.wall, target.wall);
  let x = target.x;
  let y = target.y;

  switch (edge) {
    case "right":
      x = roundDim(anchor.x + anchor.w - overlap);
      if (Math.abs(target.y - anchor.y) <= ADJACENCY_TOLERANCE_MM) y = anchor.y;
      break;
    case "left":
      x = roundDim(anchor.x - target.w + overlap);
      if (Math.abs(target.y - anchor.y) <= ADJACENCY_TOLERANCE_MM) y = anchor.y;
      break;
    case "below":
      y = roundDim(anchor.y + anchor.h - overlap);
      if (Math.abs(target.x - anchor.x) <= ADJACENCY_TOLERANCE_MM) x = anchor.x;
      break;
    case "above":
      y = roundDim(anchor.y - target.h + overlap);
      if (Math.abs(target.x - anchor.x) <= ADJACENCY_TOLERANCE_MM) x = anchor.x;
      break;
  }

  return { x, y };
}

export function createGroupId(): string {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Deterministic color for a merged group (3D + 2D accent). */
export function groupColorFromId(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 58%)`;
}

/**
 * Glue selected modules: snap adjacent pairs with wall overlap, assign shared groupId.
 * Returns updated placed array or an error message.
 */
export function mergeModules(
  placed: PlacedModule[],
  instanceIds: string[],
): { placed: PlacedModule[]; groupId: string } | { error: string } {
  if (instanceIds.length < 2) {
    return { error: "Select at least two modules to merge." };
  }

  const idSet = new Set(instanceIds);
  const selected = placed.filter((p) => idSet.has(p.instanceId));
  if (selected.length < 2) {
    return { error: "Select at least two modules to merge." };
  }

  // Include full existing groups when any member is selected.
  const pullInGroups = new Set(selected.map((p) => p.groupId).filter(Boolean) as string[]);
  for (const p of placed) {
    if (p.groupId && pullInGroups.has(p.groupId)) {
      idSet.add(p.instanceId);
    }
  }
  const mergeSelected = placed.filter((p) => idSet.has(p.instanceId));

  const positions = new Map<string, { x: number; y: number }>(
    mergeSelected.map((p) => [p.instanceId, { x: p.x, y: p.y }]),
  );

  const rects = (): ModuleRect[] =>
    mergeSelected.map((p) => {
      const pos = positions.get(p.instanceId)!;
      const base = toModuleRect(p);
      return { ...base, x: pos.x, y: pos.y };
    });

  const anchored = new Set<string>([mergeSelected[0].instanceId]);
  let progress = true;

  while (progress && anchored.size < mergeSelected.length) {
    progress = false;
    const current = rects();

    for (const target of current) {
      if (anchored.has(target.placed.instanceId)) continue;

      let best: { anchor: ModuleRect; edge: AdjacencyEdge } | null = null;
      let bestDist = Infinity;

      for (const anchor of current) {
        if (!anchored.has(anchor.placed.instanceId)) continue;
        if (anchor.placed.instanceId === target.placed.instanceId) continue;

        const edge = findAdjacency(anchor, target);
        if (!edge) continue;

        const dist = Math.abs(target.x - anchor.x) + Math.abs(target.y - anchor.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { anchor, edge };
        }
      }

      if (best) {
        const snapped = snapWithWallOverlap(best.anchor, target, best.edge);
        positions.set(target.placed.instanceId, snapped);
        anchored.add(target.placed.instanceId);
        progress = true;
      }
    }
  }

  if (anchored.size < mergeSelected.length) {
    return {
      error: "Selected modules are not adjacent. Move them closer together, then merge.",
    };
  }

  const existingGroups = [...new Set(selected.map((p) => p.groupId).filter(Boolean) as string[])];
  const groupId = existingGroups[0] ?? createGroupId();

  const updated = placed.map((p) => {
    if (!idSet.has(p.instanceId)) return p;
    const pos = positions.get(p.instanceId);
    if (!pos) return { ...p, groupId };
    return { ...p, x: pos.x, y: pos.y, groupId };
  });

  return { placed: updated, groupId };
}

/** Bounding box of all modules sharing a groupId. */
export function getGroupBounds(
  placed: PlacedModule[],
  groupId: string,
): { x: number; y: number; w: number; h: number } | null {
  const members = placed.filter((p) => p.groupId === groupId);
  if (members.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of members) {
    const { w, h } = getRotatedSize(getModule(p.moduleId), p.rotation);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function getGroupMemberIds(placed: PlacedModule[], groupId: string): string[] {
  return placed.filter((p) => p.groupId === groupId).map((p) => p.instanceId);
}
