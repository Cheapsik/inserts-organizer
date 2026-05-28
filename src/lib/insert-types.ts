export interface BoxDimensions {
  width: number;
  height: number;
}

export type ModuleType = "cards" | "tokens" | "minis" | "custom";

export interface InsertModule {
  id: string;
  name: string;
  /** Footprint width in mm (X axis) */
  width: number;
  /** Footprint height in mm (Y axis, on the 2D canvas) */
  height: number;
  /** Z-axis depth in mm — used for 3D extrusion + volumetric pricing */
  depth: number;
  /** Printed wall thickness in mm (also used for the floor). */
  wallThickness: number;
  price: number;
  color: string;
  type: ModuleType;
}

export type DividerOrientation = "horizontal" | "vertical";

export interface ModuleDivider {
  id: string;
  orientation: DividerOrientation;
  /** Offset in mm from the top (horizontal) or left (vertical) inner wall. */
  position: number;
  /** Z-axis height in mm. */
  height: number;
}

export interface PlacedModule {
  instanceId: string;
  moduleId: string;
  /** Optional per-instance wall override (falls back to module's value). */
  wallThickness?: number;
  /** When set, modules with the same id move together as one printed unit. */
  groupId?: string;
  /** Internal compartment dividers (stored in module-local mm space). */
  dividers?: ModuleDivider[];
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  isOverlapping: boolean;
  /** True when the module's footprint extends past the current workspace
   *  boundaries (e.g. the user shrunk the box). */
  isOutOfBounds?: boolean;
}

/** Default box dimensions (mm). Used as the initial state for the
 *  fully configurable workspace. */
export const DEFAULT_BOX: BoxDimensions = { width: 290, height: 290 };
export const DEFAULT_BOX_DEPTH_MM = 100;
export const MIN_BOX_MM = 50;
export const MAX_BOX_MM = 800;
/** @deprecated Use the live dimensions from the configurator store. Kept
 *  only so existing imports keep type-checking. */
export const BOX: BoxDimensions = DEFAULT_BOX;

/** Visual grid spacing (drawn on canvas background, in mm). */
export const GRID_MM = 10;

/** Step for dimension inputs (wall, footprint, box, etc.). */
export const DIM_STEP_MM = 0.1;

/** Stored precision for mm values (one decimal place). */
export const DIM_DECIMALS = 1;

/** Logical snapping resolution when placing modules on the canvas. */
export const SNAP_MM = DIM_STEP_MM;

export const roundDim = (value: number, decimals: number = DIM_DECIMALS): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** Display helper — omits trailing ".0" for whole numbers. */
export const formatMm = (value: number): string => {
  const r = roundDim(value);
  return Number.isInteger(r) ? String(r) : r.toFixed(DIM_DECIMALS);
};

/** Edge magnetism threshold (in mm) — modules within this distance of any
 *  inner wall snap flush against it. */
export const EDGE_PULL_MM = 3;

/** Default Z depth (mm) for new / built-in modules without an explicit value. */
export const DEFAULT_DEPTH_MM = 40;

/** Default wall thickness (mm) for printed insert trays. */
export const DEFAULT_WALL_MM = 2;

/**
 * Pure snapping utility — quantises a value to the nearest grid step.
 * Extracted for testability; never side-effecting.
 */
export const snapToGrid = (value: number, snapSize: number = SNAP_MM): number =>
  Math.round(value / snapSize) * snapSize;

/** Back-compat alias used by the store / clamp helpers. */
export const snap = (val: number, grid: number = SNAP_MM): number => snapToGrid(val, grid);

/**
 * Hollow-tray pricing. Approximates the printed material volume as:
 *   floor:  W * L * T
 *   walls:  perimeter * D * T  =  2*(W+L) * D * T
 * Then multiplies by a per-mm³ rate. 5 PLN minimum keeps tiny modules viable.
 */
export const priceFromVolume = (
  widthMm: number,
  heightMm: number,
  depthMm: number,
  wallMm: number = DEFAULT_WALL_MM,
): number => {
  const floor = widthMm * heightMm * wallMm;
  const walls = 2 * (widthMm + heightMm) * depthMm * wallMm;
  return Math.max(5, Math.round((floor + walls) * 0.0002));
};

const makeBuiltin = (
  m: Omit<InsertModule, "price" | "wallThickness"> & { wallThickness?: number },
): InsertModule => {
  const wallThickness = m.wallThickness ?? DEFAULT_WALL_MM;
  return {
    ...m,
    wallThickness,
    price: priceFromVolume(m.width, m.height, m.depth, wallThickness),
  };
};

export const BUILTIN_MODULES: InsertModule[] = [
  makeBuiltin({
    id: "cards-std",
    name: "Standard Cards",
    width: 70,
    height: 95,
    depth: 30,
    color: "#60a5fa",
    type: "cards",
  }),
  makeBuiltin({
    id: "tokens-sm",
    name: "Small Tokens Box",
    width: 50,
    height: 50,
    depth: 25,
    color: "#34d399",
    type: "tokens",
  }),
  makeBuiltin({
    id: "bits-long",
    name: "Long Bits Tray",
    width: 150,
    height: 50,
    depth: 20,
    color: "#fbbf24",
    type: "tokens",
  }),
  makeBuiltin({
    id: "minis-blk",
    name: "Miniatures Block",
    width: 100,
    height: 100,
    depth: 55,
    color: "#f472b6",
    type: "minis",
  }),
];

// Global mutable registry so getModule(id) works for custom modules too.
const REGISTRY = new Map<string, InsertModule>(BUILTIN_MODULES.map((m) => [m.id, m]));

export const registerModule = (m: InsertModule): void => {
  REGISTRY.set(m.id, m);
};

export const getModule = (moduleId: string): InsertModule => {
  const m = REGISTRY.get(moduleId);
  if (!m) throw new Error(`Unknown module: ${moduleId}`);
  return m;
};

export const getRotatedSize = (m: InsertModule, rotation: number): { w: number; h: number } =>
  rotation % 180 === 0 ? { w: m.width, h: m.height } : { w: m.height, h: m.width };

const CUSTOM_PALETTE = ["#a78bfa", "#22d3ee", "#fb7185", "#facc15", "#4ade80", "#f97316"];
export const nextCustomColor = (index: number): string =>
  CUSTOM_PALETTE[index % CUSTOM_PALETTE.length];
