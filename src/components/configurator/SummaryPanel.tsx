import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Link2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { useConfigurator } from "@/lib/configurator-context";
import { formatMm, getModule } from "@/lib/insert-types";
import { resolveLayerHeight } from "@/lib/layer-utils";

export function SummaryPanel() {
  const placed = useConfigurator((s) => s.placed);
  const allPlaced = useConfigurator((s) => s.allPlaced);
  const layers = useConfigurator((s) => s.layers);
  const autoPack = useConfigurator((s) => s.autoPack);
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const stackHeight = useConfigurator((s) => s.stackHeight);
  const stackOverflow = useConfigurator((s) => s.stackOverflow);
  const hasDepthOverflow = useConfigurator((s) => s.hasDepthOverflow);
  const selectedInstanceIds = useConfigurator((s) => s.selectedInstanceIds);
  const mergeSelected = useConfigurator((s) => s.mergeSelected);
  const clearSelection = useConfigurator((s) => s.clearSelection);

  const handleMerge = () => {
    const result = mergeSelected();
    if (result.ok) {
      toast.success("Modules merged — they now move as one unit.");
    } else {
      toast.error(result.error ?? "Could not merge modules.");
    }
  };

  const handleAutoPack = () => {
    if (placed.length === 0) {
      toast("Nothing to pack — add modules to this layer first.");
      return;
    }
    const { unpackedCount } = autoPack();
    if (unpackedCount > 0) {
      toast.error("Not all modules fit! Please remove some or use a larger box.", {
        description: `${unpackedCount} module${unpackedCount === 1 ? "" : "s"} could not be placed.`,
      });
    } else {
      toast.success("Layout auto-packed successfully.");
    }
  };

  const usedArea = allPlaced.reduce((s, p) => {
    const m = getModule(p.moduleId);
    return s + m.width * m.height;
  }, 0);
  const boxArea = boxWidth * boxHeight;
  const utilization = Math.min(100, boxArea > 0 ? (usedArea / boxArea) * 100 : 0);
  const hasOverlaps = allPlaced.some((p) => p.isOverlapping);
  const hasOutOfBounds = allPlaced.some((p) => p.isOutOfBounds);

  const layerLineItems = layers
    .map((layer) => {
      const height = resolveLayerHeight(layer);
      if (layer.placedModules.length === 0) return null;
      const byModule = layer.placedModules.reduce<Record<string, { name: string; count: number }>>(
        (acc, p) => {
          const m = getModule(p.moduleId);
          if (!acc[m.id]) acc[m.id] = { name: m.name, count: 0 };
          acc[m.id].count += 1;
          return acc;
        },
        {},
      );
      const parts = Object.values(byModule)
        .map((b) => `${b.name} ×${b.count}`)
        .join(", ");
      return {
        id: layer.id,
        label: `${layer.name} (${formatMm(height)}mm)`,
        parts,
      };
    })
    .filter(Boolean) as { id: string; label: string; parts: string }[];

  return (
    <aside className="glass-panel flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-2xl">
      <div className="border-b border-panel-border px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Build Summary
        </div>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Your Configuration</h2>
      </div>

      <div className="space-y-5 p-5">
        <button
          type="button"
          onClick={handleAutoPack}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15 px-4 py-2.5 text-sm font-semibold text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all hover:border-primary/70 hover:shadow-[0_0_24px_-4px_var(--primary)] active:scale-[0.98]"
        >
          <span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            aria-hidden
          />
          <Wand2 className="h-4 w-4 text-primary" />
          <span>✨ Auto-Pack Layout</span>
        </button>

        {selectedInstanceIds.length > 1 && (
          <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-sky-300">
              Multi-select · {selectedInstanceIds.length} modules
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Merge adjacent trays so their walls overlap for printing.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleMerge}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400"
              >
                <Link2 className="h-3.5 w-3.5" />
                Merge Together
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="flex items-center gap-1 rounded-lg border border-panel-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          </div>
        )}

        <Stat label="Modules" value={String(allPlaced.length)} mono />

        <div className="rounded-lg border border-panel-border bg-card/40 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Stack Height
          </div>
          <div
            className={`mt-0.5 font-mono text-lg font-semibold ${
              stackOverflow ? "text-destructive" : "text-success"
            }`}
          >
            {formatMm(stackHeight)} / {formatMm(boxDepth)} mm
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Space Utilization
            </span>
            <span className="font-mono text-xs text-foreground">{utilization.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  utilization > 95
                    ? "var(--destructive)"
                    : "linear-gradient(90deg, oklch(0.72 0.18 255), oklch(0.72 0.18 155))",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${utilization}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{usedArea.toLocaleString()} mm²</span>
            <span>{boxArea.toLocaleString()} mm²</span>
          </div>
        </div>

        {hasDepthOverflow ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Module taller than box</div>
              <div className="mt-0.5 text-destructive/80">
                One or more modules exceed the box depth ({formatMm(boxDepth)} mm).
              </div>
            </div>
          </div>
        ) : null}

        {stackOverflow ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Stack exceeds box depth</div>
              <div className="mt-0.5 text-destructive/80">
                Reduce layer heights or remove layers to fit within {formatMm(boxDepth)} mm.
              </div>
            </div>
          </div>
        ) : null}

        {hasOutOfBounds ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Modules out of bounds</div>
              <div className="mt-0.5 text-destructive/80">
                Enlarge the workspace or reposition the highlighted modules.
              </div>
            </div>
          </div>
        ) : hasOverlaps ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Collision detected</div>
              <div className="mt-0.5 text-destructive/80">
                Resolve overlapping modules.
              </div>
            </div>
          </div>
        ) : allPlaced.length > 0 && !stackOverflow && !hasDepthOverflow ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-success/40 bg-success/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="text-xs">
              <div className="font-semibold text-success">Layout is valid</div>
              <div className="mt-0.5 text-success/80">All modules fit without collisions.</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto border-t border-panel-border px-5 py-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Line Items
        </div>
        {layerLineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-panel-border p-4 text-center text-xs text-muted-foreground">
            No modules placed yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {layerLineItems.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-panel-border bg-card/40 px-3 py-2 text-sm"
              >
                <div className="text-xs font-semibold text-foreground">{item.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{item.parts}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-panel-border bg-card/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold ${mono ? "font-mono" : ""} ${
          accent ? "text-gradient" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
