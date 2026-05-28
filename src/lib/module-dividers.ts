import {
  getModule,
  roundDim,
  snap,
  type ModuleDivider,
  type PlacedModule,
} from "@/lib/insert-types";

export const DEFAULT_DIVIDER_HEIGHT_OFFSET_MM = 5;
export const MIN_DIVIDER_HEIGHT_MM = 5;

export function createDividerId(): string {
  return `div-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getModuleWallThickness(placed: PlacedModule): number {
  const m = getModule(placed.moduleId);
  return placed.wallThickness ?? m.wallThickness;
}

export function defaultDividerHeight(placed: PlacedModule): number {
  const m = getModule(placed.moduleId);
  return Math.max(MIN_DIVIDER_HEIGHT_MM, roundDim(m.depth - DEFAULT_DIVIDER_HEIGHT_OFFSET_MM));
}

export function clampDividerPosition(
  orientation: ModuleDivider["orientation"],
  position: number,
  moduleW: number,
  moduleH: number,
  wallT: number,
): number {
  const min = wallT;
  const max =
    orientation === "horizontal" ? Math.max(min, moduleH - wallT) : Math.max(min, moduleW - wallT);
  return roundDim(Math.max(min, Math.min(max, snap(position))));
}

export function clampDividerHeight(height: number, moduleDepth: number, wallT: number): number {
  const max = Math.max(MIN_DIVIDER_HEIGHT_MM, moduleDepth - wallT);
  return roundDim(Math.max(MIN_DIVIDER_HEIGHT_MM, Math.min(max, height)));
}

export function centerDividerPosition(
  orientation: ModuleDivider["orientation"],
  moduleW: number,
  moduleH: number,
  wallT: number,
): number {
  const innerW = moduleW - 2 * wallT;
  const innerH = moduleH - 2 * wallT;
  if (orientation === "horizontal") {
    return clampDividerPosition("horizontal", wallT + innerH / 2, moduleW, moduleH, wallT);
  }
  return clampDividerPosition("vertical", wallT + innerW / 2, moduleW, moduleH, wallT);
}

export function createDivider(
  placed: PlacedModule,
  orientation: ModuleDivider["orientation"],
): ModuleDivider {
  const m = getModule(placed.moduleId);
  const wallT = getModuleWallThickness(placed);
  return {
    id: createDividerId(),
    orientation,
    position: centerDividerPosition(orientation, m.width, m.height, wallT),
    height: defaultDividerHeight(placed),
  };
}

/** 2D render rect inside the placed module box (mm, local → display space). */
export function getDividerDisplayRect(
  divider: ModuleDivider,
  moduleW: number,
  moduleH: number,
  rotation: PlacedModule["rotation"],
  wallT: number,
): { left: number; top: number; width: number; height: number } {
  const p = divider.position;
  const T = wallT;

  if (divider.orientation === "horizontal") {
    switch (rotation) {
      case 90:
        return { left: p, top: T, width: T, height: moduleW - 2 * T };
      case 180:
        return { left: T, top: moduleH - p - T, width: moduleW - 2 * T, height: T };
      case 270:
        return { left: moduleH - p - T, top: T, width: T, height: moduleW - 2 * T };
      default:
        return { left: T, top: p, width: moduleW - 2 * T, height: T };
    }
  }

  switch (rotation) {
    case 90:
      return { left: T, top: moduleW - p - T, width: moduleH - 2 * T, height: T };
    case 180:
      return { left: moduleW - p - T, top: T, width: T, height: moduleH - 2 * T };
    case 270:
      return { left: T, top: p, width: moduleH - 2 * T, height: T };
    default:
      return { left: p, top: T, width: T, height: moduleH - 2 * T };
  }
}

/** Convert pointer delta on canvas to local position delta for divider drag. */
export function pointerDeltaToLocalPositionDelta(
  divider: ModuleDivider,
  rotation: PlacedModule["rotation"],
  deltaPx: number,
  deltaPy: number,
  pxPerMm: number,
): number {
  const dx = deltaPx / pxPerMm;
  const dy = deltaPy / pxPerMm;

  if (divider.orientation === "horizontal") {
    switch (rotation) {
      case 90:
        return dx;
      case 180:
        return -dy;
      case 270:
        return -dx;
      default:
        return dy;
    }
  }

  switch (rotation) {
    case 90:
      return -dy;
    case 180:
      return -dx;
    case 270:
      return dx;
    default:
      return dx;
  }
}
