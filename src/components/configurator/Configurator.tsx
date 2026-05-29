import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import { GamePresetPicker } from "@/components/configurator/GamePresetPicker";
import { ModuleLibrary } from "@/components/configurator/ModuleLibrary";
import { Canvas, CANVAS_DROPPABLE_ID } from "@/components/configurator/Canvas";
import { SummaryPanel } from "@/components/configurator/SummaryPanel";
import { GlassPanel } from "@/components/configurator/GlassPanel";
import { ThemeToggle } from "@/components/configurator/ThemeToggle";
import { WidgetEntrance } from "@/components/configurator/WidgetEntrance";
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
  MAX_BOX_MM,
  MIN_BOX_MM,
  roundDim,
  getModule,
  getRotatedSize,
  snap,
} from "@/lib/insert-types";
import { buildShareUrl, extractShareableState, isShareUrlTooLong } from "@/lib/serialize-config";
import { exportToSTL } from "@/lib/export-stl";
import { hasAnyFingerSlot, resolveFingerSlots } from "@/lib/finger-slots";
import {
  computeLayerAssembledOffsets,
  computeLayerExplodedOffsets,
} from "@/lib/layer-utils";
import { traysExportRef } from "@/lib/trays-export-ref";
import { toast } from "sonner";
import { Download, Link2, Loader2 } from "lucide-react";
import { Scene3D } from "@/components/configurator/Scene3D";
import type { ReactNode } from "react";

export function Configurator() {
  return (
    <ConfiguratorProvider>
      <ConfiguratorInner />
    </ConfiguratorProvider>
  );
}

function ConfiguratorInner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("spatial-editor");
    document.body.classList.add("spatial-editor");
    return () => {
      document.documentElement.classList.remove("spatial-editor");
      document.body.classList.remove("spatial-editor");
    };
  }, []);

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

      const others = useConfigurator.getState().placed;
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
      <main className="spatial-stage relative h-screen w-screen select-none overflow-hidden">
        <div className="spatial-void-glow absolute inset-0" />
      </main>
    );
  }

  const is2d = viewMode === "2d";
  const is3d = viewMode === "3d" && !explodedView;
  const isExploded = viewMode === "3d" && explodedView;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <main
        id="insert-configurator"
        className="spatial-stage relative h-screen w-screen select-none overflow-hidden"
      >
        <div className="spatial-void-glow absolute inset-0" />

        <div className="absolute inset-0 z-0">
          {is2d ? (
            <Canvas onCanvasRect={onCanvasRect} onPxPerMm={setPxPerMm} />
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--spatial-text-secondary)]">
                  Ładowanie widoku 3D…
                </div>
              }
            >
              <Scene3D exploded={isExploded} />
            </Suspense>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Widget A: Top center command bar */}
          <WidgetEntrance
            delay={0.1}
            className="absolute left-1/2 top-[24px] z-50 -translate-x-1/2"
          >
            <GlassPanel className="flex items-center gap-6 px-6 py-2.5">
              <span className="text-sm font-bold tracking-wider text-[var(--spatial-text-primary)]">
                PRZEGRÓDKA
              </span>

              <div className="h-4 w-[1px] bg-[var(--spatial-divider)]" />

              <div className="flex items-center gap-3 font-mono text-xs text-[var(--spatial-text-secondary)]">
                <DimInput
                  label="W"
                  value={boxWidth}
                  onChange={(v) => setBoxDimensions({ width: v })}
                />
                <DimInput
                  label="L"
                  value={boxHeight}
                  onChange={(v) => setBoxDimensions({ height: v })}
                />
                <DimInput
                  label="H"
                  value={boxDepth}
                  onChange={(v) => setBoxDimensions({ depth: v })}
                />
              </div>

              <div className="h-4 w-[1px] bg-[var(--spatial-divider)]" />

              <div className="flex rounded-full bg-[var(--spatial-toggle-track)] p-1">
                <ViewPill
                  active={is2d}
                  onClick={() => {
                    setViewMode("2d");
                    setExplodedView(false);
                  }}
                >
                  2D
                </ViewPill>
                <ViewPill
                  active={is3d}
                  onClick={() => {
                    setViewMode("3d");
                    setExplodedView(false);
                  }}
                >
                  3D
                </ViewPill>
                <ViewPill
                  active={isExploded}
                  onClick={() => {
                    setViewMode("3d");
                    setExplodedView(true);
                  }}
                >
                  EXP
                </ViewPill>
              </div>

              <div className="h-4 w-[1px] bg-[var(--spatial-divider)]" />

              <ThemeToggle />
              <GamePresetPicker iconOnly />
              <StlExportButton isExploded={isExploded} viewMode={viewMode} />
              <ShareButton />
            </GlassPanel>
          </WidgetEntrance>

          {/* Widget B: Left palette */}
          <WidgetEntrance
            delay={0.15}
            className="absolute left-[32px] top-[50%] z-40 w-[300px] -translate-y-1/2"
          >
            <GlassPanel className="flex max-h-[70vh] flex-col gap-4 p-5">
              <ModuleLibrary />
            </GlassPanel>
          </WidgetEntrance>

          {/* Widget C: Right dashboard */}
          <WidgetEntrance
            delay={0.2}
            className="absolute bottom-[32px] right-[32px] z-40 w-[340px]"
          >
            <GlassPanel className="flex flex-col gap-4 p-5">
              <SummaryPanel />
            </GlassPanel>
          </WidgetEntrance>
        </div>
      </main>

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
      className="pointer-events-none rounded-lg border border-[var(--spatial-surface-border)] px-3 py-2 font-mono text-[11px] text-[var(--spatial-text-primary)] shadow-[0_24px_48px_var(--spatial-shadow-heavy),0_8px_20px_rgba(255,140,0,0.35)]"
      style={{
        background: `linear-gradient(135deg, ${m.color}dd, ${m.color}99)`,
      }}
    >
      {m.name} · {formatMm(ghost.w)}×{formatMm(ghost.h)} mm
    </div>
  );
}

function StlExportButton({
  viewMode,
  isExploded,
}: {
  viewMode: "2d" | "3d";
  isExploded: boolean;
}) {
  const layers = useConfigurator((s) => s.layers);
  const [exporting, setExporting] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);

  const hasModules = layers.some((l) => l.placedModules.length > 0);

  const hasFingerSlots = layers.some((layer) =>
    layer.placedModules.some((p) => {
      const m = getModule(p.moduleId);
      return hasAnyFingerSlot(resolveFingerSlots(p, m));
    }),
  );

  const handleExport = async () => {
    if (exporting) return;

    if (viewMode === "2d") {
      toast.info("Przełącz na widok 3D, aby wyeksportować plik STL.");
      return;
    }

    if (!hasModules) {
      toast.error("Brak modułów do eksportu.");
      return;
    }

    setExporting(true);

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const assembled = computeLayerAssembledOffsets(layers);
    const exploded = computeLayerExplodedOffsets(assembled);
    const layerYCorrectionsMm = isExploded
      ? layers.map((_, i) => (assembled[i] ?? 0) - (exploded[i] ?? 0))
      : layers.map(() => 0);

    const ok = exportToSTL(traysExportRef, { layerYCorrectionsMm });

    setExporting(false);

    if (!ok) {
      toast.error("Nie udało się wygenerować pliku STL.");
      return;
    }

    if (hasFingerSlots) {
      toast.warning(
        "Plik STL zawiera wycięcia na palec – przed drukiem upewnij się, że slicer naprawił geometrię (Repair Mesh).",
      );
    } else {
      toast.success("Plik STL gotowy do druku!");
    }

    setFlashSuccess(true);
    window.setTimeout(() => setFlashSuccess(false), 1000);
  };

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      title="Pobierz plik STL"
      disabled={exporting}
      className={`relative flex h-4 w-4 items-center justify-center transition-colors ${
        flashSuccess
          ? "text-green-500"
          : "text-[var(--spatial-icon)] hover:text-[var(--spatial-accent)]"
      } disabled:opacity-60`}
    >
      {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
    </button>
  );
}

function ShareButton() {
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const layers = useConfigurator((s) => s.layers);
  const activeLayerId = useConfigurator((s) => s.activeLayerId);
  const customModules = useConfigurator((s) => s.customModules);

  const handleShare = async () => {
    const shareable = extractShareableState({
      boxWidth,
      boxHeight,
      boxDepth,
      layers,
      activeLayerId,
      customModules,
    });
    const url = buildShareUrl(shareable);

    if (isShareUrlTooLong(url)) {
      toast.warning("Konfiguracja jest zbyt duża, aby udostępnić ją przez link.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link skopiowany!");
    } catch {
      toast.error("Nie udało się skopiować linku.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      title="Udostępnij link"
      className="text-[var(--spatial-icon)] transition-colors hover:text-[var(--spatial-accent)]"
    >
      <Link2 size={16} />
    </button>
  );
}

function ViewPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-[var(--spatial-accent)] text-black shadow-[0_0_12px_rgba(255,140,0,0.6)]"
          : "text-[var(--spatial-view-inactive)] hover:text-[var(--spatial-text-primary)]"
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
  const [local, setLocal] = useState(String(value));
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
    <span>
      {label}{" "}
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
        className="w-10 border-b border-[var(--spatial-accent-muted)] bg-transparent text-center text-[var(--spatial-accent)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </span>
  );
}
