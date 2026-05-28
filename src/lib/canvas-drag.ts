import { clampToBox, rectsCollide, type CanvasDragSession } from "@/lib/configurator-store";
import { getGroupMemberIds } from "@/lib/merge-groups";
import { getModule, getRotatedSize, roundDim, snap, type PlacedModule } from "@/lib/insert-types";

const EDGE_PULL = 3;
const SLACK_PX = 30;

interface ComputeCanvasDragInput {
  placed: PlacedModule[];
  instanceId: string;
  moduleId: string;
  rotation: 0 | 90 | 180 | 270;
  boxWidth: number;
  boxHeight: number;
  pxPerMm: number;
  canvasRect: DOMRect;
  centerXpx: number;
  centerYpx: number;
  /** When updating mid-drag, reuse captured origins. */
  existingOrigins?: Record<string, { x: number; y: number }>;
}

function clampGroupLeadPosition(
  placed: PlacedModule[],
  groupId: string,
  leadInstanceId: string,
  leadX: number,
  leadY: number,
  origins: Record<string, { x: number; y: number }>,
  boxW: number,
  boxH: number,
): { x: number; y: number } {
  const leadOrigin = origins[leadInstanceId];
  if (!leadOrigin) return { x: leadX, y: leadY };

  let dx = leadX - leadOrigin.x;
  let dy = leadY - leadOrigin.y;
  const members = placed.filter((p) => p.groupId === groupId);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of members) {
    const origin = origins[p.instanceId] ?? { x: p.x, y: p.y };
    const m = getModule(p.moduleId);
    const { w, h } = getRotatedSize(m, p.rotation);
    minX = Math.min(minX, origin.x + dx);
    minY = Math.min(minY, origin.y + dy);
    maxX = Math.max(maxX, origin.x + dx + w);
    maxY = Math.max(maxY, origin.y + dy + h);
  }

  if (minX < 0) dx -= minX;
  if (minY < 0) dy -= minY;
  if (maxX > boxW) dx -= maxX - boxW;
  if (maxY > boxH) dy -= maxY - boxH;

  return {
    x: roundDim(leadOrigin.x + dx),
    y: roundDim(leadOrigin.y + dy),
  };
}

export function computeCanvasDragSession(input: ComputeCanvasDragInput): CanvasDragSession | null {
  const {
    placed,
    instanceId,
    moduleId,
    rotation,
    boxWidth,
    boxHeight,
    pxPerMm,
    canvasRect,
    centerXpx,
    centerYpx,
    existingOrigins,
  } = input;

  const dragged = placed.find((p) => p.instanceId === instanceId);
  if (!dragged) return null;

  const m = getModule(moduleId);
  const { w, h } = getRotatedSize(m, rotation);

  const memberInstanceIds =
    dragged.groupId != null ? getGroupMemberIds(placed, dragged.groupId) : [instanceId];

  const origins: Record<string, { x: number; y: number }> = existingOrigins ?? {};
  if (!existingOrigins) {
    for (const id of memberInstanceIds) {
      const p = placed.find((pp) => pp.instanceId === id);
      if (p) origins[id] = { x: p.x, y: p.y };
    }
  }

  const cxMm = (centerXpx - canvasRect.left) / pxPerMm;
  const cyMm = (centerYpx - canvasRect.top) / pxPerMm;

  let rawX = snap(cxMm - w / 2);
  let rawY = snap(cyMm - h / 2);
  if (rawX < EDGE_PULL) rawX = 0;
  if (rawY < EDGE_PULL) rawY = 0;
  if (boxWidth - (rawX + w) < EDGE_PULL) rawX = boxWidth - w;
  if (boxHeight - (rawY + h) < EDGE_PULL) rawY = boxHeight - h;

  let leadX: number;
  let leadY: number;

  if (dragged.groupId) {
    const clamped = clampGroupLeadPosition(
      placed,
      dragged.groupId,
      instanceId,
      rawX,
      rawY,
      origins,
      boxWidth,
      boxHeight,
    );
    leadX = clamped.x;
    leadY = clamped.y;
  } else {
    const clamped = clampToBox(rawX, rawY, w, h, boxWidth, boxHeight);
    leadX = clamped.x;
    leadY = clamped.y;
  }

  const leadOrigin = origins[instanceId] ?? { x: dragged.x, y: dragged.y };
  const dx = leadX - leadOrigin.x;
  const dy = leadY - leadOrigin.y;

  const inBounds =
    centerXpx >= canvasRect.left - SLACK_PX &&
    centerXpx <= canvasRect.right + SLACK_PX &&
    centerYpx >= canvasRect.top - SLACK_PX &&
    centerYpx <= canvasRect.bottom + SLACK_PX;

  const others = placed.filter((p) => !memberInstanceIds.includes(p.instanceId));
  const collides = others.some((other) => {
    const om = getModule(other.moduleId);
    const { w: ow, h: oh } = getRotatedSize(om, other.rotation);
    const otherRect = { x: other.x, y: other.y, w: ow, h: oh };
    return memberInstanceIds.some((gid) => {
      const gp = placed.find((p) => p.instanceId === gid);
      if (!gp) return false;
      const gm = getModule(gp.moduleId);
      const { w: gw, h: gh } = getRotatedSize(gm, gp.rotation);
      const go = origins[gid] ?? { x: gp.x, y: gp.y };
      return rectsCollide({ x: go.x + dx, y: go.y + dy, w: gw, h: gh }, otherRect);
    });
  });

  return {
    leadInstanceId: instanceId,
    memberInstanceIds,
    origins,
    leadX,
    leadY,
    w,
    h,
    rotation,
    inBounds,
    collides,
  };
}

/** Render position (mm) for a module during an active canvas drag session. */
export function getDragRenderPosition(
  session: CanvasDragSession,
  instanceId: string,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  if (!session.memberInstanceIds.includes(instanceId)) return fallback;
  const origin = session.origins[instanceId];
  const leadOrigin = session.origins[session.leadInstanceId];
  if (!origin || !leadOrigin) return fallback;
  const dx = session.leadX - leadOrigin.x;
  const dy = session.leadY - leadOrigin.y;
  return { x: origin.x + dx, y: origin.y + dy };
}
