import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Scene renders at 1 unit = 10 mm; STL expects 1 unit = 1 mm. */
const SCENE_TO_MM = 10;

const STL_FILENAME = "przegrodka-insert.stl";

export interface ExportStlOptions {
  /** Per-layer Y correction in mm (assembled minus current view offset). */
  layerYCorrectionsMm?: number[];
}

function findLayerIndex(object: THREE.Object3D): number | undefined {
  let current: THREE.Object3D | null = object;
  while (current) {
    const idx = current.userData.layerIndex;
    if (typeof idx === "number") return idx;
    current = current.parent;
  }
  return undefined;
}

/** CSG operand meshes (box/cylinder brushes) — not the evaluated wall geometry. */
function isCsgBrush(mesh: THREE.Mesh): boolean {
  return (mesh as THREE.Mesh & { isBrush?: boolean }).isBrush === true;
}

/** Strip to position-only, non-indexed — required for mergeGeometries across CSG/box/ramp meshes. */
function toPositionOnlyGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
  const ownsExpanded = expanded !== geometry;

  const positions = expanded.getAttribute("position");
  const exportGeo = new THREE.BufferGeometry();
  exportGeo.setAttribute("position", positions.clone());

  if (ownsExpanded) expanded.dispose();
  return exportGeo;
}

function collectTrayGeometries(
  root: THREE.Group,
  layerYCorrectionsMm: number[],
): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const scratchMatrix = new THREE.Matrix4();
  const yCorrection = new THREE.Matrix4();

  root.updateWorldMatrix(true, true);

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (isCsgBrush(child)) return;
    const geometry = child.geometry;
    if (!geometry?.isBufferGeometry) return;

    const layerIndex = findLayerIndex(child);
    const corrMm = layerIndex != null ? (layerYCorrectionsMm[layerIndex] ?? 0) : 0;

    scratchMatrix.copy(child.matrixWorld);
    if (corrMm !== 0) {
      yCorrection.makeTranslation(0, corrMm / SCENE_TO_MM, 0);
      scratchMatrix.premultiply(yCorrection);
    }

    const cloned = geometry.clone();
    cloned.applyMatrix4(scratchMatrix);

    const positions = cloned.getAttribute("position");
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        positions.setX(i, positions.getX(i) * SCENE_TO_MM);
        positions.setY(i, positions.getY(i) * SCENE_TO_MM);
        positions.setZ(i, positions.getZ(i) * SCENE_TO_MM);
      }
      positions.needsUpdate = true;
    }

    const exportGeo = toPositionOnlyGeometry(cloned);
    cloned.dispose();
    geometries.push(exportGeo);
  });

  return geometries;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportToSTL(
  sceneRef: { current: THREE.Group | null },
  options: ExportStlOptions = {},
): boolean {
  const root = sceneRef.current;
  if (!root) return false;

  const layerYCorrectionsMm = options.layerYCorrectionsMm ?? [];
  const geometries = collectTrayGeometries(root, layerYCorrectionsMm);

  if (geometries.length === 0) return false;

  const merged = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());

  if (!merged) return false;

  merged.computeVertexNormals();

  const mergedMesh = new THREE.Mesh(merged);
  const exporter = new STLExporter();
  const data = exporter.parse(mergedMesh, { binary: true });

  mergedMesh.geometry.dispose();

  const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
  triggerDownload(blob, STL_FILENAME);
  return true;
}
