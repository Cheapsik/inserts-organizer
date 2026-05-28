import LZString from "lz-string";
import type { InsertModule } from "@/lib/insert-types";
import type { InsertLayer } from "@/lib/layer-utils";

/** Persistent configurator payload encoded in share URLs. */
export interface ConfiguratorState {
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  layers: InsertLayer[];
  activeLayerId: string;
  customModules: InsertModule[];
}

const URL_SAFE_LIMIT = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidRotation(value: unknown): value is 0 | 90 | 180 | 270 {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function isValidPlacedModule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.instanceId === "string" &&
    typeof value.moduleId === "string" &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isValidRotation(value.rotation)
  );
}

function isValidLayer(value: unknown): value is InsertLayer {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string") return false;
  if (value.heightMode !== "auto" && value.heightMode !== "manual") return false;
  if (value.manualHeight !== null && !isFiniteNumber(value.manualHeight)) return false;
  if (!Array.isArray(value.placedModules)) return false;
  return value.placedModules.every(isValidPlacedModule);
}

function isValidInsertModule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.depth) &&
    typeof value.color === "string" &&
    typeof value.type === "string"
  );
}

function isValidConfiguratorState(value: unknown): value is ConfiguratorState {
  if (!isRecord(value)) return false;
  if (
    !isFiniteNumber(value.boxWidth) ||
    !isFiniteNumber(value.boxHeight) ||
    !isFiniteNumber(value.boxDepth)
  ) {
    return false;
  }
  if (typeof value.activeLayerId !== "string") return false;
  if (!Array.isArray(value.layers) || value.layers.length === 0) return false;
  if (!value.layers.every(isValidLayer)) return false;
  if (!value.layers.some((l) => l.id === value.activeLayerId)) return false;
  if (!Array.isArray(value.customModules)) return false;
  if (!value.customModules.every(isValidInsertModule)) return false;
  return true;
}

export function extractShareableState(state: {
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  layers: InsertLayer[];
  activeLayerId: string;
  customModules: InsertModule[];
}): ConfiguratorState {
  return {
    boxWidth: state.boxWidth,
    boxHeight: state.boxHeight,
    boxDepth: state.boxDepth,
    layers: state.layers,
    activeLayerId: state.activeLayerId,
    customModules: state.customModules,
  };
}

export function serializeConfig(state: ConfiguratorState): string {
  const jsonString = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(jsonString);
}

export function deserializeConfig(encoded: string): ConfiguratorState | null {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(encoded);
    if (jsonString == null || jsonString === "") return null;
    const parsed: unknown = JSON.parse(jsonString);
    if (!isValidConfiguratorState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ConfiguratorState): string {
  const encoded = serializeConfig(state);
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("config", encoded);
  return url.toString();
}

export function isShareUrlTooLong(url: string): boolean {
  return url.length > URL_SAFE_LIMIT;
}
