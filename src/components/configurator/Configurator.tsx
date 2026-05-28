import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ModuleLibrary } from "@/components/configurator/ModuleLibrary";
import { Canvas, CANVAS_DROPPABLE_ID } from "@/components/configurator/Canvas";
import { SummaryPanel } from "@/components/configurator/SummaryPanel";
import { ConfiguratorProvider } from "@/lib/configurator-context";
import {
  clampToBox,
  rectsCollide,
  useConfigurator,
  type DragGhost,
} from "@/lib/configurator-store";
import { computeCanvasDragSession } from "@/lib/canvas-drag";
import {
  DIM_STEP_MM,
  formatMm,
  GRID_MM,
  MAX_BOX_MM,
  MIN_BOX_MM,
  roundDim,
  getModule,
  getRotatedSize,
  snap,
} from "@/lib/insert-types";
import { Boxes, Box as BoxIcon, Layers3, UnfoldVertical } from "lucide-react";

const Scene3D = lazy(() =>
  import("@/components/configurator/Scene3D").then((m) => ({ default: m.Scene3D })),
);

export function Configurator() {
  return (
    <ConfiguratorProvider>
      <ConfiguratorInner />
    </ConfiguratorProvider>
  );
}

function ConfiguratorInner() {
  // Avoid SSR hydration mismatches from dnd-kit aria ids, number formatting, etc.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const addModule = useConfigurator((s) => s.addModule);
  const moveModule = useConfigurator((s) => s.moveModule);
  const setGhost = useConfigurator((s) => s.setGhost);
  const setCanvasDrag = useConfigurator((s) => s.setCanvasDrag);
  const clearDragState = useConfigurator((s) => s.clearDragState);
  const viewMode = useConfigurator((s) => s.viewMode);
  const setViewMode = useConfigurator((s) => s.setViewMode);
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const setBoxDimensions = useConfigurator((s) => s.setBoxDimensions);
  const [explodedView, setExplodedView] = useState(false);

  const canvasRectRef = useRef<DOMRect | null>(null);
  const [pxPerMm, setPxPerMm] = useState(1);

  const onCanvasRect = useCallback((r: DOMRect | null) => {
    canvasRectRef.current = r;
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /** Snap ghost for library → canvas drops only. */
  const computeLibraryGhost = useCallback(
    (event: DragStartEvent | DragMoveEvent, moduleId: string): DragGhost | null => {
      const canvasRect = canvasRectRef.current;
      if (!canvasRect || pxPerMm <= 0) return null;
      const translated = event.active.rect.current.translated;
      if (!translated) return null;

      const m = getModule(moduleId);
      const { w, h } = getRotatedSize(m, 0);

      const centerXpx = translated.left + translated.width / 2;
      const centerYpx = translated.top + translated.height / 2;
      const cxMm = (centerXpx - canvasRect.left) / pxPerMm;
      const cyMm = (centerYpx - canvasRect.top) / pxPerMm;

      const rawX = snap(cxMm - w / 2);
      const rawY = snap(cyMm - h / 2);

      const EDGE_PULL = 3;
      let x = rawX;
      let y = rawY;
      if (x < EDGE_PULL) x = 0;
      if (y < EDGE_PULL) y = 0;
      if (boxWidth - (x + w) < EDGE_PULL) x = boxWidth - w;
      if (boxHeight - (y + h) < EDGE_PULL) y = boxHeight - h;

      const clamped = clampToBox(x, y, w, h, boxWidth, boxHeight);

      const SLACK = 30;
      const inBounds =
        centerXpx >= canvasRect.left - SLACK &&
        centerXpx <= canvasRect.right + SLACK &&
        centerYpx >= canvasRect.top - SLACK &&
        centerYpx <= canvasRect.bottom + SLACK;

      const others = useConfigurator.getState().placed; // active layer only
      const ghostRect = { x: clamped.x, y: clamped.y, w, h };
      const collides = others.some((p) => {
        const om = getModule(p.moduleId);
        const { w: ow, h: oh } = getRotatedSize(om, p.rotation);
        return rectsCollide(ghostRect, { x: p.x, y: p.y, w: ow, h: oh });
      });

      return {
        source: "library",
        moduleId,
        x: clamped.x,
        y: clamped.y,
        w,
        h,
        rotation: 0,
        inBounds,
        collides,
      };
    },
    [pxPerMm, boxWidth, boxHeight],
  );

  const buildCanvasDrag = useCallback(
    (
      event: DragStartEvent | DragMoveEvent,
      instanceId: string,
      moduleId: string,
      rotation: 0 | 90 | 180 | 270,
    ) => {
      const canvasRect = canvasRectRef.current;
      if (!canvasRect || pxPerMm <= 0) return null;
      const translated = event.active.rect.current.translated;
      if (!translated) return null;

      const centerXpx = translated.left + translated.width / 2;
      const centerYpx = translated.top + translated.height / 2;
      const existingOrigins = useConfigurator.getState().canvasDrag?.origins;

      return computeCanvasDragSession({
        placed: useConfigurator.getState().placed,
        instanceId,
        moduleId,
        rotation,
        boxWidth,
        boxHeight,
        pxPerMm,
        canvasRect,
        centerXpx,
        centerYpx,
        existingOrigins,
      });
    },
    [pxPerMm, boxWidth, boxHeight],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { source: "library"; moduleId: string }
      | { source: "canvas"; instanceId: string; moduleId: string }
      | undefined;
    if (!data) return;
    if (data.source === "library") {
      setCanvasDrag(null);
      setGhost(computeLibraryGhost(event, data.moduleId));
    } else {
      setGhost(null);
      const placed = useConfigurator
        .getState()
        .placed.find((p) => p.instanceId === data.instanceId);
      if (!placed) return;
      const session = buildCanvasDrag(event, data.instanceId, data.moduleId, placed.rotation);
      if (session) setCanvasDrag(session);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const data = event.active.data.current as
      | { source: "library"; moduleId: string }
      | { source: "canvas"; instanceId: string; moduleId: string }
      | undefined;
    if (!data) return;
    if (data.source === "library") {
      setGhost(computeLibraryGhost(event, data.moduleId));
    } else {
      const placed = useConfigurator
        .getState()
        .placed.find((p) => p.instanceId === data.instanceId);
      if (!placed) return;
      const session = buildCanvasDrag(event, data.instanceId, data.moduleId, placed.rotation);
      if (session) setCanvasDrag(session);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const data = active.data.current as
      | { source: "library"; moduleId: string }
      | { source: "canvas"; instanceId: string; moduleId: string }
      | undefined;

    if (!data) {
      clearDragState();
      return;
    }

    if (data.source === "library") {
      const ghost = useConfigurator.getState().ghost;
      clearDragState();
      if (!ghost) return;
      if (!over || over.id !== CANVAS_DROPPABLE_ID) return;
      if (!ghost.inBounds) return;
      addModule(data.moduleId, ghost.x + ghost.w / 2, ghost.y + ghost.h / 2);
      return;
    }

    const session = useConfigurator.getState().canvasDrag;
    if (!session) {
      clearDragState();
      return;
    }

    if (!session.inBounds) {
      moveModule(data.instanceId, -1000, -1000, session.origins);
      return;
    }

    moveModule(data.instanceId, session.leadX, session.leadY, session.origins);
  };

  const handleDragCancel = () => clearDragState();

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="glass-panel rounded-2xl px-6 py-4 text-sm text-muted-foreground">
          Loading configurator…
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen w-full flex-col gap-4 p-4">
        {/* Header */}
        <header className="glass-panel flex items-center justify-between rounded-2xl px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="btn-primary-glow flex h-9 w-9 items-center justify-center rounded-lg">
              <Boxes className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Tabletop Foundry
              </div>
              <h1 className="text-sm font-semibold text-foreground">
                Board Game Insert Configurator
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} />
            {viewMode === "3d" && (
              <ExplodedViewToggle active={explodedView} onChange={setExplodedView} />
            )}
          </div>

          <div className="hidden items-center gap-3 font-mono text-xs text-muted-foreground md:flex">
            <DimInput label="W" value={boxWidth} onChange={(v) => setBoxDimensions({ width: v })} />
            <DimInput
              label="L"
              value={boxHeight}
              onChange={(v) => setBoxDimensions({ height: v })}
            />
            <DimInput label="D" value={boxDepth} onChange={(v) => setBoxDimensions({ depth: v })} />
            <span className="h-3 w-px bg-border" />
            <span>Grid: {GRID_MM} mm</span>
          </div>
        </header>

        {/* Main */}
        <div className="flex min-h-0 flex-1 gap-4">
          <ModuleLibrary />
          <main className="glass-panel relative flex min-w-0 flex-1 overflow-hidden rounded-2xl">
            {viewMode === "2d" ? (
              <Canvas onCanvasRect={onCanvasRect} onPxPerMm={setPxPerMm} />
            ) : (
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Loading 3D scene…
                  </div>
                }
              >
                <Scene3D exploded={explodedView} />
              </Suspense>
            )}
          </main>
          <SummaryPanel />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        <DragGhostChip />
      </DragOverlay>
    </DndContext>
  );
}

function DragGhostChip() {
  const ghost = useConfigurator((s) => s.ghost);
  if (!ghost || ghost.source !== "library") return null;
  const m = getModule(ghost.moduleId);
  return (
    <div
      className="pointer-events-none rounded-md border border-white/30 px-2.5 py-1.5 font-mono text-[11px] text-white shadow-2xl backdrop-blur"
      style={{
        background: `linear-gradient(135deg, ${m.color}cc, ${m.color}88)`,
      }}
    >
      {m.name} · {formatMm(ghost.w)}×{formatMm(ghost.h)}mm
    </div>
  );
}

function ExplodedViewToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? "btn-primary-glow border-primary/50 text-primary-foreground"
          : "border-panel-border bg-card/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <UnfoldVertical className="h-3.5 w-3.5" />
      Exploded
    </button>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: "2d" | "3d";
  onChange: (v: "2d" | "3d") => void;
}) {
  return (
    <div className="relative flex items-center rounded-full border border-panel-border bg-card/60 p-1 text-xs font-medium">
      <ToggleButton active={value === "2d"} onClick={() => onChange("2d")}>
        <BoxIcon className="h-3.5 w-3.5" />
        2D
      </ToggleButton>
      <ToggleButton active={value === "3d"} onClick={() => onChange("3d")}>
        <Layers3 className="h-3.5 w-3.5" />
        3D
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all ${
        active
          ? "btn-primary-glow text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DimInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState<string>(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(local.replace(",", "."));
    if (!Number.isFinite(n)) {
      setLocal(String(value));
      return;
    }
    const clamped = Math.max(MIN_BOX_MM, Math.min(MAX_BOX_MM, roundDim(n)));
    onChange(clamped);
    setLocal(String(clamped));
  };
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-panel-border bg-card/60 px-2 py-1 text-foreground transition-colors focus-within:border-primary/60">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        min={MIN_BOX_MM}
        max={MAX_BOX_MM}
        step={DIM_STEP_MM}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        className="w-14 bg-transparent text-right font-mono text-xs outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-[10px] text-muted-foreground/70">mm</span>
    </label>
  );
}
