import { Canvas as R3FCanvas } from "@react-three/fiber";
import { Html, OrbitControls, Environment } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { Base, Geometry, Subtraction } from "@react-three/csg";
import { Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { formatMm, getModule, getRotatedSize, type PlacedModule } from "@/lib/insert-types";
import {
  resolveFingerSlots,
  slotAlongWallOffsetMm,
  type FingerSlotConfig,
  type FingerSlotWallKey,
  type TrayWall3D,
} from "@/lib/finger-slots";
import { useConfigurator } from "@/lib/configurator-store";
import { groupColorFromId } from "@/lib/merge-groups";
import {
  getRampIndices,
  getRampVertices,
  rampSurfaceHeightMm,
  resolveRampConfig,
  type RampConfig,
} from "@/lib/ramp-config";
import {
  computeLayerAssembledOffsets,
  computeLayerExplodedOffsets,
  EXPLODE_GAP_MM,
  resolveLayerHeight,
  type InsertLayer,
} from "@/lib/layer-utils";

const WALL_3D_TO_LOCAL: Record<TrayWall3D, FingerSlotWallKey> = {
  left: "left",
  right: "right",
  front: "bottom",
  back: "top",
};

const SCALE = 1 / 10;
const FLOOR_THICKNESS_MM = 4;
const DEFAULT_MODULE_H_MM = 40;
const SPRING_CONFIG = { mass: 1, tension: 170, friction: 26 };

function mmToUnits(mm: number) {
  return mm * SCALE;
}

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

function createRampWedgeGeometry(
  wall: RampConfig["wall"],
  halfW: number,
  halfL: number,
  height: number,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(getRampVertices(wall, halfW, halfL, height), 3),
  );
  geo.setIndex(getRampIndices(wall));
  geo.computeVertexNormals();
  return geo;
}

function TrayFloor({
  innerWidthU,
  innerLengthU,
  thicknessU,
  rampConfig,
  material,
}: {
  innerWidthU: number;
  innerLengthU: number;
  thicknessU: number;
  rampConfig: RampConfig;
  material: ReactNode;
}) {
  const halfW = innerWidthU / 2;
  const halfL = innerLengthU / 2;
  const heightU = mmToUnits(rampConfig.startHeight);

  const rampGeo = useMemo(() => {
    if (!rampConfig.enabled) return null;
    return createRampWedgeGeometry(rampConfig.wall, halfW, halfL, heightU);
  }, [rampConfig.enabled, rampConfig.wall, rampConfig.startHeight, halfW, halfL, heightU]);

  useEffect(() => () => rampGeo?.dispose(), [rampGeo]);

  if (!rampConfig.enabled) {
    return (
      <mesh position={[0, thicknessU / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[innerWidthU + 2 * thicknessU, thicknessU, innerLengthU + 2 * thicknessU]} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh geometry={rampGeo!} castShadow receiveShadow>
      {material}
    </mesh>
  );
}

function TrayMaterial({
  displayColor,
  isOverlapping,
  stackOverflow,
  inactiveLayer,
}: {
  displayColor: string;
  isOverlapping: boolean;
  stackOverflow: boolean;
  inactiveLayer: boolean;
}) {
  const color = useMemo(() => new THREE.Color(displayColor), [displayColor]);
  const overflowEmissive = useMemo(() => new THREE.Color("#ff2200"), []);

  const emissive = stackOverflow ? overflowEmissive : color;
  const emissiveIntensity = stackOverflow ? 0.3 : isOverlapping ? 0.45 : 0.04;

  return (
    <meshStandardMaterial
      color={color}
      roughness={0.55}
      metalness={0.08}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent={inactiveLayer}
      opacity={inactiveLayer ? 0.35 : 1}
      depthWrite={!inactiveLayer}
    />
  );
}

function InsertTray3D({
  p,
  boxW,
  boxH,
  stackOverflow,
  inactiveLayer,
}: {
  p: PlacedModule;
  boxW: number;
  boxH: number;
  stackOverflow: boolean;
  inactiveLayer: boolean;
}) {
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

  const material = (
    <TrayMaterial
      displayColor={displayColor}
      isOverlapping={p.isOverlapping}
      stackOverflow={stackOverflow}
      inactiveLayer={inactiveLayer}
    />
  );

  const rotY = -(p.rotation * Math.PI) / 180;
  const dividers = p.dividers ?? [];
  const fingerSlots = resolveFingerSlots(p, m);
  const innerWidthMm = localW - 2 * tMm;
  const innerLengthMm = localH - 2 * tMm;
  const innerLengthU = L - 2 * T;
  const innerWidthU = W - 2 * T;
  const rampConfig = resolveRampConfig(p, m, dMm, tMm);

  const slotFor3DWall = (wall3d: TrayWall3D) => fingerSlots[WALL_3D_TO_LOCAL[wall3d]];

  const rampBaseY = (xFromCenterMm: number, zFromCenterMm: number) =>
    mmToUnits(rampSurfaceHeightMm(xFromCenterMm, zFromCenterMm, rampConfig, innerWidthMm, innerLengthMm));

  const floorTopY = T;

  return (
    <group position={[x3, y3, z3]} rotation={[0, rotY, 0]}>
      <TrayFloor
        innerWidthU={innerWidthU}
        innerLengthU={innerLengthU}
        thicknessU={T}
        rampConfig={rampConfig}
        material={material}
      />
      <TrayWall
        position={[-W / 2 + T / 2, D / 2, 0]}
        size={[T, D, L]}
        material={material}
        slot={slotFor3DWall("left")}
        wallLenMm={localH}
        lengthAxis="z"
      />
      <TrayWall
        position={[W / 2 - T / 2, D / 2, 0]}
        size={[T, D, L]}
        material={material}
        slot={slotFor3DWall("right")}
        wallLenMm={localH}
        lengthAxis="z"
      />
      <TrayWall
        position={[0, D / 2, L / 2 - T / 2]}
        size={[W - 2 * T, D, T]}
        material={material}
        slot={slotFor3DWall("front")}
        wallLenMm={localW - 2 * tMm}
        lengthAxis="x"
      />
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
          const zFromCenterMm = -innerLengthMm / 2 + (div.position - tMm);
          const baseY = rampConfig.enabled ? rampBaseY(0, zFromCenterMm) : floorTopY;
          return (
            <mesh
              key={div.id}
              position={[0, divH / 2 + baseY, mmToUnits(div.position) - L / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[innerWidthU, divH, divT]} />
              {material}
            </mesh>
          );
        }
        const xFromCenterMm = div.position - tMm - innerWidthMm / 2;
        const baseY = rampConfig.enabled ? rampBaseY(xFromCenterMm, 0) : floorTopY;
        return (
          <mesh
            key={div.id}
            position={[mmToUnits(div.position) - W / 2, divH / 2 + baseY, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[divT, divH, innerLengthU]} />
            {material}
          </mesh>
        );
      })}
    </group>
  );
}

const WALL_MATERIAL = (
  <meshStandardMaterial color="#1a1a2e" transparent opacity={0.4} roughness={0.5} metalness={0.1} />
);

function BoxContainer({ boxW, boxH, boxD }: { boxW: number; boxH: number; boxD: number }) {
  const W = mmToUnits(boxW);
  const D = mmToUnits(boxH);
  const wallH = mmToUnits(boxD);
  const wallT = mmToUnits(3);

  const walls: { p: [number, number, number]; s: [number, number, number] }[] = [
    { p: [0, wallH / 2, -D / 2 - wallT / 2], s: [W + wallT * 2, wallH, wallT] },
    { p: [0, wallH / 2, D / 2 + wallT / 2], s: [W + wallT * 2, wallH, wallT] },
    { p: [-W / 2 - wallT / 2, wallH / 2, 0], s: [wallT, wallH, D] },
    { p: [W / 2 + wallT / 2, wallH / 2, 0], s: [wallT, wallH, D] },
  ];

  return (
    <group>
      <gridHelper
        args={[Math.max(W, D), Math.max(boxW, boxH) / 10, "#3b4658", "#252b39"]}
        position={[0, 0.001, 0]}
      />
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.p} receiveShadow>
          <boxGeometry args={wall.s} />
          {WALL_MATERIAL}
        </mesh>
      ))}
    </group>
  );
}

function CeilingLimit({ boxW, boxH, boxD }: { boxW: number; boxH: number; boxD: number }) {
  const W = mmToUnits(boxW);
  const D = mmToUnits(boxH);
  const y = mmToUnits(boxD);
  const thin = mmToUnits(0.5);

  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[W, thin, D]} />
      <meshStandardMaterial
        color="#ff2200"
        transparent
        opacity={0.25}
        emissive="#ff2200"
        emissiveIntensity={0.2}
        depthWrite={false}
      />
    </mesh>
  );
}

const GAP_LINE_COLOR = "#6688cc";

/**
 * Thin cross + height label in the center of the explode gap below layer[i].
 * Placed at mid-gap (not on module tops) so it stays in empty space as layers move up.
 */
function LayerGapMarker({
  index,
  assembledY,
  explodedY,
  resolvedHeight,
  layerName,
  exploded,
  boxW,
  boxH,
}: {
  index: number;
  assembledY: number;
  explodedY: number;
  resolvedHeight: number;
  layerName: string;
  exploded: boolean;
  boxW: number;
  boxH: number;
}) {
  const targetLayerY = mmToUnits(exploded ? explodedY : assembledY);
  const { y: layerSpringY } = useSpring({
    y: targetLayerY,
    config: SPRING_CONFIG,
    delay: index * 80,
  });

  const resolvedU = mmToUnits(resolvedHeight);
  const gapHalfU = mmToUnits(EXPLODE_GAP_MM / 2);
  const W = mmToUnits(boxW);
  const D = mmToUnits(boxH);

  const crossGeometry = useMemo(() => {
    const positions = [
      -W / 2, 0, 0, W / 2, 0, 0,
      0, 0, -D / 2, 0, 0, D / 2,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [W, D]);

  useEffect(() => () => crossGeometry.dispose(), [crossGeometry]);

  if (!exploded) return null;

  return (
    <animated.group position-y={layerSpringY.to((v) => v + resolvedU + gapHalfU)}>
      <lineSegments geometry={crossGeometry} raycast={() => null} renderOrder={5}>
        <lineBasicMaterial
          color={GAP_LINE_COLOR}
          transparent
          opacity={0.6}
          depthWrite={false}
          depthTest={false}
        />
      </lineSegments>
      <Html position={[0, 0, 0]} center distanceFactor={14} zIndexRange={[100, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded border border-[#6688cc]/40 bg-card/90 px-2 py-0.5 font-mono text-[10px] text-[#9ab4e8] shadow-md backdrop-blur">
          {layerName} · {formatMm(resolvedHeight)} mm
        </div>
      </Html>
    </animated.group>
  );
}

function LayerGroup3D({
  layer,
  index,
  assembledY,
  explodedY,
  resolvedHeight,
  exploded,
  isActive,
  isStackOverflow,
  boxW,
  boxH,
}: {
  layer: InsertLayer;
  index: number;
  assembledY: number;
  explodedY: number;
  resolvedHeight: number;
  exploded: boolean;
  isActive: boolean;
  isStackOverflow: boolean;
  boxW: number;
  boxH: number;
}) {
  const targetY = mmToUnits(exploded ? explodedY : assembledY);
  const { y } = useSpring({
    y: targetY,
    config: SPRING_CONFIG,
    delay: index * 80,
  });

  const labelY = mmToUnits(resolvedHeight + 12);

  return (
    <animated.group position-y={y}>
        {isActive && (
          <pointLight
            position={[0, mmToUnits(resolvedHeight + 30), 0]}
            intensity={0.6}
            color="#4488ff"
            distance={mmToUnits(200)}
          />
        )}
        {layer.placedModules.map((p) => (
          <InsertTray3D
            key={p.instanceId}
            p={p}
            boxW={boxW}
            boxH={boxH}
            stackOverflow={isStackOverflow}
            inactiveLayer={!isActive}
          />
        ))}
        {exploded && (
          <Html position={[0, labelY, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
            <div className="pointer-events-none whitespace-nowrap rounded-md border border-panel-border bg-card/90 px-2 py-1 font-mono text-[10px] text-foreground shadow-lg backdrop-blur">
              {layer.name} — {formatMm(resolvedHeight)}mm
            </div>
          </Html>
        )}
    </animated.group>
  );
}

function SceneContent({ exploded }: { exploded: boolean }) {
  const layers = useConfigurator((s) => s.layers);
  const activeLayerId = useConfigurator((s) => s.activeLayerId);
  const overflowingLayerIds = useConfigurator((s) => s.overflowingLayerIds);
  const stackOverflow = useConfigurator((s) => s.stackOverflow);
  const boxW = useConfigurator((s) => s.boxWidth);
  const boxH = useConfigurator((s) => s.boxHeight);
  const boxD = useConfigurator((s) => s.boxDepth);
  const maxSide = Math.max(boxW, boxH);

  const assembledOffsets = useMemo(() => computeLayerAssembledOffsets(layers), [layers]);
  const explodedOffsets = useMemo(
    () => computeLayerExplodedOffsets(assembledOffsets),
    [assembledOffsets],
  );
  const resolvedHeights = useMemo(() => layers.map(resolveLayerHeight), [layers]);

  return (
    <>
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
        {stackOverflow && <CeilingLimit boxW={boxW} boxH={boxH} boxD={boxD} />}
        {layers.map((layer, i) => (
          <LayerGroup3D
            key={layer.id}
            layer={layer}
            index={i}
            assembledY={assembledOffsets[i] ?? 0}
            explodedY={explodedOffsets[i] ?? 0}
            resolvedHeight={resolvedHeights[i] ?? 0}
            exploded={exploded}
            isActive={layer.id === activeLayerId}
            isStackOverflow={overflowingLayerIds.includes(layer.id)}
            boxW={boxW}
            boxH={boxH}
          />
        ))}
        {exploded &&
          layers.map((layer, i) => {
            if (i >= layers.length - 1) return null;
            return (
              <LayerGapMarker
                key={`gap-marker-${layer.id}`}
                index={i}
                assembledY={assembledOffsets[i] ?? 0}
                explodedY={explodedOffsets[i] ?? 0}
                resolvedHeight={resolvedHeights[i] ?? 0}
                layerName={layer.name}
                exploded={exploded}
                boxW={boxW}
                boxH={boxH}
              />
            );
          })}
      </Suspense>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={mmToUnits(maxSide) * 0.6}
        maxDistance={mmToUnits(maxSide) * 4}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

export function Scene3D({ exploded }: { exploded: boolean }) {
  const boxW = useConfigurator((s) => s.boxWidth);
  const boxH = useConfigurator((s) => s.boxHeight);
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
        <SceneContent exploded={exploded} />
      </R3FCanvas>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-panel-border bg-card/70 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
        Drag to orbit · Scroll to zoom · Right-click to pan
      </div>
    </div>
  );
}
