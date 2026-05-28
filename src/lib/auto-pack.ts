import { getGroupBounds } from "@/lib/merge-groups";
import { getModule, getRotatedSize, roundDim, type PlacedModule } from "@/lib/insert-types";

export interface AutoPackResult {
  placed: PlacedModule[];
  unpacked: PlacedModule[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PackUnit {
  key: string;
  members: PlacedModule[];
  w: number;
  h: number;
  area: number;
  /** Offset from unit top-left to each member's current position. */
  offsets: Map<string, { dx: number; dy: number }>;
  boundsX: number;
  boundsY: number;
  canRotate: boolean;
}

const collides = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function findSlot(
  w: number,
  h: number,
  placed: Rect[],
  boxW: number,
  boxH: number,
): { x: number; y: number } | null {
  if (w > boxW || h > boxH) return null;
  const xs = new Set<number>([0]);
  const ys = new Set<number>([0]);
  for (const r of placed) {
    if (r.x + r.w <= boxW - w) xs.add(r.x + r.w);
    if (r.y + r.h <= boxH - h) ys.add(r.y + r.h);
  }
  const ysSorted = [...ys].filter((y) => y + h <= boxH).sort((a, b) => a - b);
  const xsSorted = [...xs].filter((x) => x + w <= boxW).sort((a, b) => a - b);
  for (const y of ysSorted) {
    for (const x of xsSorted) {
      const candidate: Rect = { x, y, w, h };
      let ok = true;
      for (const r of placed) {
        if (collides(candidate, r)) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
  }
  return null;
}

function buildPackUnits(modules: PlacedModule[]): PackUnit[] {
  const units: PackUnit[] = [];
  const seenGroups = new Set<string>();
  const seenInstances = new Set<string>();

  for (const p of modules) {
    if (seenInstances.has(p.instanceId)) continue;

    if (p.groupId) {
      if (seenGroups.has(p.groupId)) continue;
      seenGroups.add(p.groupId);
      const members = modules.filter((m) => m.groupId === p.groupId);
      members.forEach((m) => seenInstances.add(m.instanceId));
      const bounds = getGroupBounds(members, p.groupId);
      if (!bounds) continue;
      const offsets = new Map<string, { dx: number; dy: number }>();
      for (const m of members) {
        offsets.set(m.instanceId, { dx: m.x - bounds.x, dy: m.y - bounds.y });
      }
      units.push({
        key: p.groupId,
        members,
        w: bounds.w,
        h: bounds.h,
        area: bounds.w * bounds.h,
        offsets,
        boundsX: bounds.x,
        boundsY: bounds.y,
        canRotate: false,
      });
      continue;
    }

    seenInstances.add(p.instanceId);
    const m = getModule(p.moduleId);
    const { w, h } = getRotatedSize(m, p.rotation);
    units.push({
      key: p.instanceId,
      members: [p],
      w,
      h,
      area: w * h,
      offsets: new Map([[p.instanceId, { dx: 0, dy: 0 }]]),
      boundsX: p.x,
      boundsY: p.y,
      canRotate: true,
    });
  }

  return units;
}

/**
 * Pure 2D bin packer. Merged groups are packed as rigid bounding boxes;
 * ungrouped modules may rotate 90° when needed.
 */
export function autoPack(
  modules: PlacedModule[],
  boxWidth: number,
  boxHeight: number,
): AutoPackResult {
  const units = buildPackUnits(modules);
  units.sort((a, b) => b.area - a.area || Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const fitted: Rect[] = [];
  const packed: PlacedModule[] = [];
  const unpacked: PlacedModule[] = [];

  for (const unit of units) {
    let slot = findSlot(unit.w, unit.h, fitted, boxWidth, boxHeight);
    let w = unit.w;
    let h = unit.h;
    let rotationDelta = 0;

    if (!slot && unit.canRotate && unit.w !== unit.h) {
      slot = findSlot(unit.h, unit.w, fitted, boxWidth, boxHeight);
      if (slot) {
        w = unit.h;
        h = unit.w;
        rotationDelta = 90;
      }
    }

    if (!slot) {
      for (const m of unit.members) {
        unpacked.push({ ...m, isOverlapping: true });
      }
      continue;
    }

    const slotX = roundDim(slot.x);
    const slotY = roundDim(slot.y);
    fitted.push({ x: slotX, y: slotY, w, h });

    for (const m of unit.members) {
      const offset = unit.offsets.get(m.instanceId)!;
      let nx = roundDim(slotX + offset.dx);
      let ny = roundDim(slotY + offset.dy);
      let rotation = m.rotation;

      if (rotationDelta !== 0 && unit.members.length === 1) {
        rotation = ((m.rotation + rotationDelta) % 360) as 0 | 90 | 180 | 270;
        nx = slotX;
        ny = slotY;
      }

      packed.push({
        ...m,
        x: nx,
        y: ny,
        rotation,
        isOverlapping: false,
      });
    }
  }

  return { placed: [...packed, ...unpacked], unpacked };
}
