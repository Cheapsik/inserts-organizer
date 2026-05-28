const roundVal = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface FingerSlotConfig {
  enabled: boolean;
  /** How deep the U-cut goes down the wall (mm). */
  depth: number;
  /** Width / diameter of the U-cut (mm). */
  width: number;
  /** Offset along the wall length (0–100%, 50 = centered). */
  position: number;
}

export interface FingerSlotsConfig {
  top: FingerSlotConfig;
  bottom: FingerSlotConfig;
  left: FingerSlotConfig;
  right: FingerSlotConfig;
}

export type FingerSlotWallKey = keyof FingerSlotsConfig;

export const DEFAULT_FINGER_SLOT_DEPTH_MM = 15;
export const DEFAULT_FINGER_SLOT_WIDTH_MM = 30;
export const DEFAULT_FINGER_SLOT_POSITION = 50;

/** Canvas background — finger-slot indicators match this color. */
export const CANVAS_BG = "oklch(0.13 0.012 260)";

export type TrayWall3D = "left" | "right" | "front" | "back";

const WALL_KEYS: FingerSlotWallKey[] = ["top", "bottom", "left", "right"];

export const createDefaultFingerSlot = (): FingerSlotConfig => ({
  enabled: false,
  depth: DEFAULT_FINGER_SLOT_DEPTH_MM,
  width: DEFAULT_FINGER_SLOT_WIDTH_MM,
  position: DEFAULT_FINGER_SLOT_POSITION,
});

export const createDefaultFingerSlots = (): FingerSlotsConfig => ({
  top: createDefaultFingerSlot(),
  bottom: createDefaultFingerSlot(),
  left: createDefaultFingerSlot(),
  right: createDefaultFingerSlot(),
});

export const cloneFingerSlots = (slots: FingerSlotsConfig): FingerSlotsConfig => ({
  top: { ...slots.top },
  bottom: { ...slots.bottom },
  left: { ...slots.left },
  right: { ...slots.right },
});

export const getWallLengthMm = (
  wall: FingerSlotWallKey,
  moduleWidth: number,
  moduleHeight: number,
): number => (wall === "top" || wall === "bottom" ? moduleWidth : moduleHeight);

export const clampFingerSlot = (
  slot: FingerSlotConfig,
  wall: FingerSlotWallKey,
  moduleWidth: number,
  moduleHeight: number,
  moduleDepth: number,
): FingerSlotConfig => {
  const wallLen = getWallLengthMm(wall, moduleWidth, moduleHeight);
  const maxWidth = Math.max(10, roundVal(wallLen));
  const maxDepth = Math.max(5, roundVal(moduleDepth));
  return {
    enabled: slot.enabled,
    depth: roundVal(Math.max(5, Math.min(maxDepth, slot.depth))),
    width: roundVal(Math.max(10, Math.min(maxWidth, slot.width))),
    position: roundVal(Math.max(10, Math.min(90, slot.position)), 0),
  };
};

export const clampAllFingerSlots = (
  slots: FingerSlotsConfig,
  moduleWidth: number,
  moduleHeight: number,
  moduleDepth: number,
): FingerSlotsConfig =>
  WALL_KEYS.reduce(
    (acc, wall) => {
      acc[wall] = clampFingerSlot(slots[wall], wall, moduleWidth, moduleHeight, moduleDepth);
      return acc;
    },
    {} as FingerSlotsConfig,
  );

export const hasAnyFingerSlot = (slots: FingerSlotsConfig): boolean =>
  WALL_KEYS.some((wall) => slots[wall].enabled);

export const resolveFingerSlots = (
  placed: { fingerSlots?: FingerSlotsConfig } | undefined,
  module: { fingerSlots?: FingerSlotsConfig },
): FingerSlotsConfig =>
  cloneFingerSlots(placed?.fingerSlots ?? module.fingerSlots ?? createDefaultFingerSlots());

/** Map a module-local wall to the canvas edge for a given rotation. */
export const localWallToCanvasEdge = (
  rotation: 0 | 90 | 180 | 270,
  wall: FingerSlotWallKey,
): FingerSlotWallKey => {
  const maps: Record<0 | 90 | 180 | 270, Record<FingerSlotWallKey, FingerSlotWallKey>> = {
    0: { top: "top", bottom: "bottom", left: "left", right: "right" },
    90: { top: "right", bottom: "left", left: "bottom", right: "top" },
    180: { top: "bottom", bottom: "top", left: "right", right: "left" },
    270: { top: "left", bottom: "right", left: "top", right: "bottom" },
  };
  return maps[rotation][wall];
};

/** Map a module-local wall to the corresponding 3D tray wall mesh. */
export const localWallTo3D = (wall: FingerSlotWallKey): TrayWall3D =>
  ({ left: "left", right: "right", top: "back", bottom: "front" })[wall];

export const slotAlongWallOffsetMm = (slot: FingerSlotConfig, wallLengthMm: number): number =>
  (slot.position / 100 - 0.5) * wallLengthMm;
