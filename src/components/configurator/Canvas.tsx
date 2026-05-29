import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  formatMm,
  getModule,
  getRotatedSize,
  GRID_MM,
  type PlacedModule,
} from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-context";
import type { DragGhost } from "@/lib/configurator-context";
import { toast } from "sonner";
import { PlacedModuleItem } from "./PlacedModuleItem";

export const CANVAS_DROPPABLE_ID = "canvas-droppable";

interface Props {
  onCanvasRect: (rect: DOMRect | null) => void;
  onPxPerMm: (v: number) => void;
}

export function Canvas({ onCanvasRect, onPxPerMm }: Props) {
  const placed = useConfigurator((s) => s.placed);
  const layers = useConfigurator((s) => s.layers);
  const activeLayerId = useConfigurator((s) => s.activeLayerId);
  const ghost = useConfigurator((s) => s.ghost);
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const selectedInstanceIds = useConfigurator((s) => s.selectedInstanceIds);
  const mergeSelected = useConfigurator((s) => s.mergeSelected);
  const clearSelection = useConfigurator((s) => s.clearSelection);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const ghostModules = layers.filter((l) => l.id !== activeLayerId).flatMap((l) => l.placedModules);

  const innerRef = useRef<HTMLDivElement | null>(null);
  const [pxPerMm, setPxPerMm] = useState(1);

  const setRefs = (el: HTMLDivElement | null) => {
    innerRef.current = el;
    setNodeRef(el);
  };

  useEffect(() => {
    const update = () => {
      const el = innerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = rect.width / boxWidth;
      setPxPerMm(ratio);
      onPxPerMm(ratio);
      onCanvasRect(rect);
    };
    update();
    const ro = new ResizeObserver(update);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [onPxPerMm, onCanvasRect, boxWidth, boxHeight]);

  const gridStep = GRID_MM * pxPerMm;

  const showGhost = !!ghost && ghost.source === "library" && ghost.inBounds;
  const showMergeBar = selectedInstanceIds.length > 1;

  const handleMerge = () => {
    const result = mergeSelected();
    if (result.ok) toast.success("Moduły połączone.");
    else toast.error(result.error ?? "Nie udało się połączyć modułów.");
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Full-viewport void grid */}
      <div
        className="canvas-grid-mask pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--spatial-grid) 1px, transparent 1px),
            linear-gradient(to bottom, var(--spatial-grid) 1px, transparent 1px)
          `,
          backgroundSize: pxPerMm ? `${gridStep}px ${gridStep}px` : undefined,
        }}
        aria-hidden
      />

      {showMergeBar && (
        <MergeActionBar
          count={selectedInstanceIds.length}
          onMerge={handleMerge}
          onCancel={clearSelection}
        />
      )}

      {/* Box boundary — centered wireframe on the void */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="relative"
          style={{
            width: `min(72vw, calc(72vh * ${boxWidth / boxHeight}))`,
            aspectRatio: `${boxWidth} / ${boxHeight}`,
          }}
        >
          <div
            ref={setRefs}
            className="relative h-full w-full bg-transparent"
            onClick={() => clearSelection()}
            style={{
              border: "1px solid #ff8c00",
              boxShadow: isOver
                ? "0 0 32px rgba(255,140,0,0.5), 0 0 20px rgba(255,140,0,0.3)"
                : "0 0 20px rgba(255,140,0,0.3)",
              transition: "box-shadow 0.25s ease",
            }}
          >
            {ghostModules.map((p) => (
              <GhostModuleOutline key={p.instanceId} placed={p} pxPerMm={pxPerMm} />
            ))}

            <AnimatePresence>
              {placed.map((p) => (
                <PlacedModuleItem key={p.instanceId} placed={p} pxPerMm={pxPerMm} />
              ))}
            </AnimatePresence>

            {showGhost && ghost && <SnapGhost ghost={ghost} pxPerMm={pxPerMm} />}

            {placed.length === 0 && !showGhost && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-[11px] text-[var(--spatial-canvas-hint)]">
                  Przeciągnij moduły tutaj
                </p>
              </div>
            )}
          </div>

          <p className="pointer-events-none absolute -bottom-6 left-0 right-0 text-center font-mono text-[11px] text-[var(--spatial-text-secondary)]">
            {formatMm(boxWidth)} × {formatMm(boxHeight)} mm
          </p>
        </div>
      </div>
    </div>
  );
}

function GhostModuleOutline({ placed, pxPerMm }: { placed: PlacedModule; pxPerMm: number }) {
  const m = getModule(placed.moduleId);
  const { w, h } = getRotatedSize(m, placed.rotation);
  return (
    <div
      className="pointer-events-none absolute border border-[var(--spatial-ghost-outline)]"
      style={{
        left: placed.x * pxPerMm,
        top: placed.y * pxPerMm,
        width: w * pxPerMm,
        height: h * pxPerMm,
        opacity: 0.06,
        zIndex: 1,
      }}
      aria-hidden
    />
  );
}

function MergeActionBar({
  count,
  onMerge,
  onCancel,
}: {
  count: number;
  onMerge: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute left-1/2 top-[88px] z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--spatial-glass-border)] px-4 py-2 shadow-[var(--spatial-glass-shadow)] backdrop-blur-[20px]"
      style={{ background: "var(--spatial-merge-glass)" }}
    >
      <span className="font-mono text-[11px] text-[var(--spatial-text-secondary)]">{count} zazn.</span>
      <button
        type="button"
        onClick={onMerge}
        className="flex items-center gap-1.5 rounded-full bg-[var(--spatial-accent)] px-3 py-1 text-xs font-semibold text-black shadow-[0_0_12px_rgba(255,140,0,0.6)]"
      >
        <Link2 className="h-3.5 w-3.5" />
        Połącz
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-[var(--spatial-icon)] hover:text-[var(--spatial-text-primary)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function SnapGhost({ ghost, pxPerMm }: { ghost: DragGhost; pxPerMm: number }) {
  const m = getModule(ghost.moduleId);
  const bad = ghost.collides;

  return (
    <motion.div
      initial={false}
      animate={{
        left: ghost.x * pxPerMm,
        top: ghost.y * pxPerMm,
        width: ghost.w * pxPerMm,
        height: ghost.h * pxPerMm,
      }}
      transition={{ type: "spring", stiffness: 800, damping: 40, mass: 0.4 }}
      style={{ position: "absolute", zIndex: 60, pointerEvents: "none" }}
    >
      <div
        className="animate-ghost-pulse h-full w-full"
        style={{
          background: bad
            ? `repeating-linear-gradient(45deg, #f87171 0 8px, transparent 8px 16px)`
            : `linear-gradient(135deg, ${m.color}66, ${m.color}22)`,
          border: bad ? "1px dashed #f87171" : "1px dashed rgba(255,140,0,0.8)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.9), 0 8px 20px rgba(255,140,0,0.35)",
          borderRadius: 4,
          opacity: 0.75,
        }}
      />
    </motion.div>
  );
}
