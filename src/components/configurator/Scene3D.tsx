import { Canvas as R3FCanvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Base, Geometry, Subtraction } from "@react-three/csg";
import { Suspense, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { getModule, getRotatedSize, type PlacedModule } from "@/lib/insert-types";
import {
  resolveFingerSlots,
  slotAlongWallOffsetMm,
  type FingerSlotConfig,
  type FingerSlotWallKey,
  type TrayWall3D,
} from "@/lib/finger-slots";
import { useConfigurator } from "@/lib/configurator-store";
import { groupColorFromId } from "@/lib/merge-groups";

const WALL_3D_TO_LOCAL: Record<TrayWall3D, FingerSlotWallKey> = {
  left: "left",
  right: "right",
  front: "bottom",
  back: "top",
};

function FingerSlotCutouts({
  slot,
  wallT,
  wallH,
  wallLenMm,
  lengthAxis,
}: {
  slot: FingerSlotConfig;
  wallT: number;
  wallH: number;
  wallLenMm: number;
  lengthAxis: "x" | "z";
}) {
  const r = mmToUnits(slot.width / 2);
  const depthU = mmToUnits(slot.depth);
  const widthU = mmToUnits(slot.width);
  const alongOffset = mmToUnits(slotAlongWallOffsetMm(slot, wallLenMm));
  const pierce = wallT * 3;

  const cylY = wallH / 2 - depthU + r;
  const boxH = Math.max(0, depthU - r);
  const boxY = wallH / 2 - boxH / 2;

  const along: [number, number, number] =
    lengthAxis === "z" ? [0, 0, alongOffset] : [alongOffset, 0, 0];
  const cylRotation: [number, number, number] =
    lengthAxis === "z" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  const boxArgs: [number, number, number] =
    lengthAxis === "z" ? [pierce, boxH, widthU] : [widthU, boxH, pierce];

  return (
    <>
      {boxH > 0.001 && (
        <Subtraction position={[along[0], boxY, along[2]]}>
          <boxGeometry args={boxArgs} />
        </Subtraction>
      )}
      <Subtraction position={[along[0], cylY, along[2]]} rotation={cylRotation}>
        <cylinderGeometry args={[r, r, pierce, 32]} />
      </Subtraction>
    </>
  );
}

function TrayWall({
  position,
  size,
  material,
  slot,
  wallLenMm,
  lengthAxis,
}: {
  position: [number, number, number];
  size: [number, number, number];
  material: ReactNode;
  slot?: FingerSlotConfig | null;
  wallLenMm: number;
  lengthAxis: "x" | "z";
}) {
  const [wallT, wallH, wallLen] = size;

  if (!slot?.enabled) {
    return (
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh position={position} castShadow receiveShadow>
      <Geometry computeVertexNormals>
        <Base>
          <boxGeometry args={[wallT, wallH, wallLen]} />
        </Base>
        <FingerSlotCutouts
          slot={slot}
          wallT={wallT}
          wallH={wallH}
          wallLenMm={wallLenMm}
          lengthAxis={lengthAxis}
        />
      </Geometry>
      {material}
    </mesh>
  );
}

// Convert mm coordinate space (origin top-left, y-down) to a centered 3D scene
// in arbitrary units. We scale 1 mm = 1 unit / 100 for camera comfort.
const SCALE = 1 / 10; // 1mm -> 0.1 unit
const FLOOR_THICKNESS_MM = 4;
const DEFAULT_MODULE_H_MM = 40;

function mmToUnits(mm: number) {
  return mm * SCALE;
}

/**
 * Hollow open-top tray built from 5 box meshes (floor + 4 walls).
 * The group origin sits on the inside of the box floor (y=0), so
 * positioning matches the 2D placement reference (top-left in mm).
 */
function InsertTray3D({ p, boxW, boxH }: { p: PlacedModule; boxW: number; boxH: number }) {
  const m = getModule(p.moduleId);
  const localW = m.width;
  const localH = m.height;
  const dMm = m.depth ?? DEFAULT_MODULE_H_MM;
  const tMm = Math.max(
    0.5,
    Math.min(p.wallThickness ?? m.wallThickness, Math.min(localW, localH) / 2 - 0.5),
  );

  const displayColor = p.groupId ? groupColorFromId(p.groupId) : m.color;

  const { w: footprintW, h: footprintH } = getRotatedSize(m, p.rotation);
  const W = mmToUnits(localW);
  const L = mmToUnits(localH);
  const D = mmToUnits(dMm);
  const T = mmToUnits(tMm);

  const cx = p.x + footprintW / 2;
  const cy = p.y + footprintH / 2;
  const x3 = mmToUnits(cx - boxW / 2);
  const z3 = mmToUnits(cy - boxH / 2);
  const y3 = mmToUnits(FLOOR_THICKNESS_MM / 2);

  const color = useMemo(() => new THREE.Color(displayColor), [displayColor]);
  const emissiveIntensity = p.isOverlapping ? 0.45 : 0.04;

  const dividerMaterial = (
    <meshStandardMaterial
      color={color}
      roughness={0.55}
      metalness={0.08}
      emissive={color}
      emissiveIntensity={emissiveIntensity}
    />
  );

  const material = dividerMaterial;

  const rotY = -(p.rotation * Math.PI) / 180;
  const dividers = p.dividers ?? [];
  const fingerSlots = resolveFingerSlots(p, m);

  const slotFor3DWall = (wall3d: TrayWall3D) => fingerSlots[WALL_3D_TO_LOCAL[wall3d]];

  return (
    <group position={[x3, y3, z3]} rotation={[0, rotY, 0]}>
      {/* Bottom floor */}
      <mesh position={[0, T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, T, L]} />
        {material}
      </mesh>
      {/* Left wall */}
      <TrayWall
        position={[-W / 2 + T / 2, D / 2, 0]}
        size={[T, D, L]}
        material={material}
        slot={slotFor3DWall("left")}
        wallLenMm={localH}
        lengthAxis="z"
      />
      {/* Right wall */}
      <TrayWall
        position={[W / 2 - T / 2, D / 2, 0]}
        size={[T, D, L]}
        material={material}
        slot={slotFor3DWall("right")}
        wallLenMm={localH}
        lengthAxis="z"
      />
      {/* Front wall */}
      <TrayWall
        position={[0, D / 2, L / 2 - T / 2]}
        size={[W - 2 * T, D, T]}
        material={material}
        slot={slotFor3DWall("front")}
        wallLenMm={localW - 2 * tMm}
        lengthAxis="x"
      />
      {/* Back wall */}
      <TrayWall
        position={[0, D / 2, -L / 2 + T / 2]}
        size={[W - 2 * T, D, T]}
        material={material}
        slot={slotFor3DWall("back")}
        wallLenMm={localW - 2 * tMm}
        lengthAxis="x"
      />

      {dividers.map((div) => {
        const divH = mmToUnits(Math.min(div.height, dMm - tMm));
        const divT = T;
        if (div.orientation === "horizontal") {
          return (
            <mesh
              key={div.id}
              position={[0, divH / 2 + T, mmToUnits(div.position) - L / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[W - 2 * divT, divH, divT]} />
              {dividerMaterial}
            </mesh>
          );
        }
        return (
          <mesh
            key={div.id}
            position={[mmToUnits(div.position) - W / 2, divH / 2 + T, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[divT, divH, L - 2 * divT]} />
            {dividerMaterial}
          </mesh>
        );
      })}
    </group>
  );
}

function BoxContainer({ boxW, boxH, boxD }: { boxW: number; boxH: number; boxD: number }) {
  const W = mmToUnits(boxW);
  const D = mmToUnits(boxH);
  const wallH = mmToUnits(boxD);
  const floorT = mmToUnits(FLOOR_THICKNESS_MM);
  const wallT = mmToUnits(3);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -floorT / 2, 0]} receiveShadow>
        <boxGeometry args={[W, floorT, D]} />
        <meshStandardMaterial color="#1a1f2e" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Grid on floor */}
      <gridHelper
        args={[Math.max(W, D), Math.max(boxW, boxH) / 10, "#3b4658", "#252b39"]}
        position={[0, 0.001, 0]}
      />

      {/* Walls (semi-transparent) */}
      {[
        { p: [0, wallH / 2, -D / 2 - wallT / 2], s: [W + wallT * 2, wallH, wallT] },
        { p: [0, wallH / 2, D / 2 + wallT / 2], s: [W + wallT * 2, wallH, wallT] },
        { p: [-W / 2 - wallT / 2, wallH / 2, 0], s: [wallT, wallH, D] },
        { p: [W / 2 + wallT / 2, wallH / 2, 0], s: [wallT, wallH, D] },
      ].map((wall, i) => (
        <mesh key={i} position={wall.p as [number, number, number]} castShadow>
          <boxGeometry args={wall.s as [number, number, number]} />
          <meshPhysicalMaterial
            color="#7d8aa3"
            transparent
            opacity={0.18}
            roughness={0.1}
            metalness={0.2}
            transmission={0.6}
            thickness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Scene3D() {
  const placed = useConfigurator((s) => s.placed);
  const boxW = useConfigurator((s) => s.boxWidth);
  const boxH = useConfigurator((s) => s.boxHeight);
  const boxD = useConfigurator((s) => s.boxDepth);
  const maxSide = Math.max(boxW, boxH);
  const camDist = mmToUnits(maxSide) * 1.6;

  return (
    <div className="relative h-full w-full">
      <R3FCanvas
        shadows
        camera={{
          position: [camDist, camDist * 0.9, camDist],
          fov: 35,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
      >
        <color attach="background" args={["#0b0f1a"]} />
        <fog attach="fog" args={["#0b0f1a", mmToUnits(maxSide) * 1.5, mmToUnits(maxSide) * 4]} />

        <ambientLight intensity={0.55} />
        <directionalLight
          position={[mmToUnits(300), mmToUnits(500), mmToUnits(300)]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-mmToUnits(maxSide)}
          shadow-camera-right={mmToUnits(maxSide)}
          shadow-camera-top={mmToUnits(maxSide)}
          shadow-camera-bottom={-mmToUnits(maxSide)}
        />
        <directionalLight
          position={[-mmToUnits(200), mmToUnits(300), -mmToUnits(100)]}
          intensity={0.4}
        />

        <Suspense fallback={null}>
          <Environment preset="city" />
          <BoxContainer boxW={boxW} boxH={boxH} boxD={boxD} />
          {placed.map((p) => (
            <InsertTray3D key={p.instanceId} p={p} boxW={boxW} boxH={boxH} />
          ))}
        </Suspense>

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={mmToUnits(maxSide) * 0.6}
          maxDistance={mmToUnits(maxSide) * 4}
          maxPolarAngle={Math.PI / 2.05}
        />
      </R3FCanvas>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-panel-border bg-card/70 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
        Drag to orbit · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
