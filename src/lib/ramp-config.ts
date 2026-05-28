const roundVal = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export type RampWall = "top" | "bottom" | "left" | "right";

export interface RampConfig {
  enabled: boolean;
  /** Wall that stays at full ramp height; opposite wall sits on the floor (y = 0). */
  wall: RampWall;
  /** Ramp height at the high wall (mm). */
  startHeight: number;
}

export const MIN_RAMP_HEIGHT_MM = 5;

export const createDefaultRampConfig = (): RampConfig => ({
  enabled: false,
  wall: "left",
  startHeight: 15,
});

export const cloneRampConfig = (config: RampConfig): RampConfig => ({ ...config });

export const clampRampConfig = (
  config: RampConfig,
  moduleDepthMm: number,
  wallThicknessMm: number,
): RampConfig => {
  const maxH = Math.max(MIN_RAMP_HEIGHT_MM, roundVal(moduleDepthMm - wallThicknessMm));
  return {
    enabled: config.enabled,
    wall: config.wall,
    startHeight: roundVal(Math.max(MIN_RAMP_HEIGHT_MM, Math.min(maxH, config.startHeight))),
  };
};

export const resolveRampConfig = (
  placed: { rampConfig?: RampConfig } | undefined,
  module: { rampConfig?: RampConfig },
  moduleDepthMm: number,
  wallThicknessMm: number,
): RampConfig =>
  clampRampConfig(
    cloneRampConfig(placed?.rampConfig ?? module.rampConfig ?? createDefaultRampConfig()),
    moduleDepthMm,
    wallThicknessMm,
  );

/**
 * Ramp surface height (mm above cavity floor) at a point in inner module space
 * (origin at tray center, +X right, +Z toward front/bottom wall).
 */
export const rampSurfaceHeightMm = (
  xFromCenterMm: number,
  zFromCenterMm: number,
  config: RampConfig,
  innerWidthMm: number,
  innerLengthMm: number,
): number => {
  if (!config.enabled) return 0;
  const { wall, startHeight: H } = config;
  const halfW = innerWidthMm / 2;
  const halfL = innerLengthMm / 2;

  switch (wall) {
    case "left":
      return H * Math.max(0, Math.min(1, (halfW - xFromCenterMm) / innerWidthMm));
    case "right":
      return H * Math.max(0, Math.min(1, (xFromCenterMm + halfW) / innerWidthMm));
    case "top":
      return H * Math.max(0, Math.min(1, (halfL - zFromCenterMm) / innerLengthMm));
    case "bottom":
      return H * Math.max(0, Math.min(1, (zFromCenterMm + halfL) / innerLengthMm));
  }
};

/** CSS gradient angle (deg) for 2D ramp indicator after module rotation. */
export const rampGradientAngleCss = (
  rotation: 0 | 90 | 180 | 270,
  wall: RampWall,
): number => {
  const local: Record<RampWall, number> = {
    left: 90,
    right: 270,
    top: 180,
    bottom: 0,
  };
  const delta: Record<0 | 90 | 180 | 270, number> = { 0: 0, 90: 90, 180: 180, 270: 270 };
  return (local[wall] + delta[rotation]) % 360;
};

/** Six wedge vertices in inner tray space (centered, y up). */
export function getRampVertices(
  wall: RampWall,
  halfW: number,
  halfL: number,
  height: number,
): Float32Array {
  const layouts: Record<RampWall, [number, number, number][]> = {
    left: [
      [-halfW, 0, -halfL],
      [-halfW, 0, halfL],
      [halfW, 0, -halfL],
      [halfW, 0, halfL],
      [-halfW, height, -halfL],
      [-halfW, height, halfL],
    ],
    right: [
      [-halfW, 0, -halfL],
      [-halfW, 0, halfL],
      [halfW, 0, -halfL],
      [halfW, 0, halfL],
      [halfW, height, -halfL],
      [halfW, height, halfL],
    ],
    top: [
      [-halfW, 0, halfL],
      [halfW, 0, halfL],
      [-halfW, 0, -halfL],
      [halfW, 0, -halfL],
      [-halfW, height, -halfL],
      [halfW, height, -halfL],
    ],
    bottom: [
      [-halfW, 0, -halfL],
      [halfW, 0, -halfL],
      [-halfW, 0, halfL],
      [halfW, 0, halfL],
      [-halfW, height, halfL],
      [halfW, height, halfL],
    ],
  };
  return new Float32Array(layouts[wall].flat());
}

/** Eight triangles: 2 end caps + bottom + high wall + slope. */
export function getRampIndices(wall: RampWall): number[] {
  if (wall === "left" || wall === "right") {
    return [
      0, 1, 3, 0, 3, 2,
      0, 2, 4,
      1, 3, 5,
      0, 1, 5, 0, 5, 4,
      4, 5, 3, 4, 3, 2,
    ];
  }
  return [
    0, 1, 3, 0, 3, 2,
    0, 2, 4,
    1, 3, 5,
    2, 3, 5, 2, 5, 4,
    4, 5, 1, 4, 1, 0,
  ];
}
