import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatMm, getModule, GRID_MM } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-store";
import { toast } from "sonner";
import { PlacedModuleItem } from "./PlacedModuleItem";

export const CANVAS_DROPPABLE_ID = "canvas-droppable";

interface Props {
  onCanvasRect: (rect: DOMRect | null) => void;
  onPxPerMm: (v: number) => void;
}

export function Canvas({ onCanvasRect, onPxPerMm }: Props) {
  const placed = useConfigurator((s) => s.placed);
  const ghost = useConfigurator((s) => s.ghost);
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const selectedInstanceIds = useConfigurator((s) => s.selectedInstanceIds);
  const mergeSelected = useConfigurator((s) => s.mergeSelected);
  const clearSelection = useConfigurator((s) => s.clearSelection);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_DROPPABLE_ID });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
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
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [onPxPerMm, onCanvasRect, boxWidth, boxHeight]);

  const gridStep = GRID_MM * pxPerMm;
  const majorStep = gridStep * 5;

  const showGhost = !!ghost && ghost.source === "library" && ghost.inBounds;
  const showMergeBar = selectedInstanceIds.length > 1;

  const handleMerge = () => {
    const result = mergeSelected();
    if (result.ok) {
      toast.success("Modules merged — they now move as one unit.");
    } else {
      toast.error(result.error ?? "Could not merge modules.");
    }
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,oklch(0.72_0.18_255/0.08),transparent_60%)]" />

      {showMergeBar && (
        <MergeActionBar
          count={selectedInstanceIds.length}
          onMerge={handleMerge}
          onCancel={clearSelection}
        />
      )}

      <div className="relative flex h-full w-full max-h-full max-w-full items-center justify-center">
        <div
          ref={wrapperRef}
          className="relative"
          style={{
            aspectRatio: `${boxWidth} / ${boxHeight}`,
            width: "min(100%, calc(100vh - 220px))",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <div className="absolute -top-6 left-0 right-0 flex items-center justify-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-px w-8 bg-border" />
            {formatMm(boxWidth)} mm
            <span className="h-px w-8 bg-border" />
          </div>
          <div className="absolute -left-12 top-0 bottom-0 flex items-center justify-center font-mono text-[11px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
            <span className="my-1 h-8 w-px bg-border" />
            {formatMm(boxHeight)} mm
            <span className="my-1 h-8 w-px bg-border" />
          </div>

          <div
            ref={setRefs}
            className={`relative h-full w-full overflow-hidden rounded-lg border-2 transition-colors ${
              isOver ? "border-primary shadow-[var(--shadow-glow)]" : "border-white/10"
            }`}
            onClick={() => clearSelection()}
            style={{
              background: "oklch(0.13 0.012 260)",
              backgroundImage: pxPerMm
                ? `
                  linear-gradient(to right, var(--grid-line-strong) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--grid-line-strong) 1px, transparent 1px),
                  linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)
                `
                : undefined,
              backgroundSize: `${majorStep}px ${majorStep}px, ${majorStep}px ${majorStep}px, ${gridStep}px ${gridStep}px, ${gridStep}px ${gridStep}px`,
              boxShadow: "inset 0 0 80px oklch(0 0 0 / 0.6)",
            }}
          >
            <div className="pointer-events-none absolute left-2 top-2 font-mono text-[10px] text-muted-foreground/60">
              0,0
            </div>

            <AnimatePresence>
              {placed.map((p) => (
                <PlacedModuleItem key={p.instanceId} placed={p} pxPerMm={pxPerMm} />
              ))}
            </AnimatePresence>

            {showGhost && ghost && <SnapGhost ghost={ghost} pxPerMm={pxPerMm} />}

            {placed.length === 0 && !showGhost && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg border border-dashed border-white/10 px-6 py-4 text-center">
                  <div className="text-sm font-medium text-muted-foreground">Empty Insert Bay</div>
                  <div className="mt-1 text-xs text-muted-foreground/70">
                    Drag modules from the library to begin
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground/50">
                    Shift+click to multi-select · Merge adjacent modules
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
      className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-sky-400/40 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md"
    >
      <span className="font-mono text-[11px] text-muted-foreground">{count} selected</span>
      <button
        type="button"
        onClick={onMerge}
        className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-400"
      >
        <Link2 className="h-3.5 w-3.5" />
        Merge Together
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 rounded-lg border border-panel-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Cancel
      </button>
    </motion.div>
  );
}

function SnapGhost({
  ghost,
  pxPerMm,
}: {
  ghost: NonNullable<ReturnType<typeof useConfigurator.getState>["ghost"]>;
  pxPerMm: number;
}) {
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
      style={{
        position: "absolute",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        className="animate-ghost-pulse h-full w-full"
        style={{
          background: bad
            ? `repeating-linear-gradient(45deg, var(--destructive) 0 8px, transparent 8px 16px)`
            : `linear-gradient(135deg, ${m.color}55, ${m.color}20)`,
          border: bad ? `2px dashed var(--destructive)` : `2px dashed rgba(255,255,255,0.8)`,
          boxShadow: bad
            ? "0 0 30px -5px var(--destructive)"
            : `0 0 30px -5px ${m.color}, inset 0 0 0 1px ${m.color}80`,
          borderRadius: 6,
          opacity: 0.6,
        }}
      >
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-white drop-shadow">
            {formatMm(ghost.x)}, {formatMm(ghost.y)} mm
          </div>
          <div className="font-mono text-[10px] text-white/80">
            {formatMm(ghost.w)}×{formatMm(ghost.h)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
