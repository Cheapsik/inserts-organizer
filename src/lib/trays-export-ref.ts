import type * as THREE from "three";

/** Shared ref to the tray-only export group inside the R3F scene (outside React context). */
export const traysExportRef: { current: THREE.Group | null } = { current: null };
