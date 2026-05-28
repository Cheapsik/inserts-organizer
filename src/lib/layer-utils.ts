import { getModule, type PlacedModule } from "@/lib/insert-types";

export interface InsertLayer {
  id: string;
  name: string;
  heightMode: "auto" | "manual";
  manualHeight: number | null;
  placedModules: PlacedModule[];
}

export interface ConfiguratorCoreState {
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  layers: InsertLayer[];
  activeLayerId: string;
}

const LAYER_ACCENTS = [
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#f97316",
];

export function layerAccentColor(index: number): string {
  return LAYER_ACCENTS[index % LAYER_ACCENTS.length];
}

export function createLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultLayer(name: string, id?: string): InsertLayer {
  return {
    id: id ?? createLayerId(),
    name,
    heightMode: "auto",
    manualHeight: null,
    placedModules: [],
  };
}

/** Resolved layer height in mm (stacking + validation). */
/** Vertical gap between layers in 3D exploded view (mm). */
export const EXPLODE_GAP_MM = 40;

export function resolveLayerHeight(layer: InsertLayer): number {
  if (layer.heightMode === "manual") {
    return layer.manualHeight ?? 0;
  }
  if (layer.placedModules.length === 0) return 0;
  return Math.max(
    ...layer.placedModules.map((m) => getModule(m.moduleId).depth),
  );
}

export function maxLayerCount(boxDepth: number): number {
  return Math.max(1, Math.floor(boxDepth / 10));
}

export function getActiveLayer(state: ConfiguratorCoreState): InsertLayer | undefined {
  return state.layers.find((l) => l.id === state.activeLayerId);
}

export function getAllPlacedModules(layers: InsertLayer[]): PlacedModule[] {
  return layers.flatMap((l) => l.placedModules);
}

/** Bottom Y offset (mm) for each layer in assembled stack. */
export function computeLayerAssembledOffsets(layers: InsertLayer[]): number[] {
  const heights = layers.map(resolveLayerHeight);
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < layers.length; i++) {
    offsets.push(acc);
    acc += heights[i] ?? 0;
  }
  return offsets;
}

export function computeLayerExplodedOffsets(assembledOffsets: number[]): number[] {
  return assembledOffsets.map((y, i) => y + i * EXPLODE_GAP_MM);
}

export interface LayerValidation {
  layers: InsertLayer[];
  resolvedHeights: number[];
  stackHeight: number;
  stackOverflow: boolean;
  overflowingLayerIds: Set<string>;
  hasDepthOverflow: boolean;
}

export function validateLayers(
  layers: InsertLayer[],
  boxDepth: number,
): LayerValidation {
  const resolvedHeights = layers.map(resolveLayerHeight);
  const stackHeight = resolvedHeights.reduce((s, h) => s + h, 0);
  const stackOverflow = stackHeight > boxDepth;

  const overflowingLayerIds = new Set<string>();
  if (stackOverflow) {
    let cumulative = 0;
    for (let i = 0; i < layers.length; i++) {
      cumulative += resolvedHeights[i];
      if (cumulative > boxDepth) {
        overflowingLayerIds.add(layers[i].id);
      }
    }
  }

  let hasDepthOverflow = false;
  const layersWithFlags = layers.map((layer) => ({
    ...layer,
    placedModules: layer.placedModules.map((m) => {
      const depth = getModule(m.moduleId).depth;
      const isDepthOverflow = depth > boxDepth;
      if (isDepthOverflow) hasDepthOverflow = true;
      return { ...m, isDepthOverflow };
    }),
  }));

  return {
    layers: layersWithFlags,
    resolvedHeights,
    stackHeight,
    stackOverflow,
    overflowingLayerIds,
    hasDepthOverflow,
  };
}

export function migrateFlatPlaced(placed: PlacedModule[]): ConfiguratorCoreState {
  const layer = createDefaultLayer("Layer 1");
  layer.placedModules = placed;
  return {
    boxWidth: 290,
    boxHeight: 290,
    boxDepth: 100,
    layers: [layer],
    activeLayerId: layer.id,
  };
}
