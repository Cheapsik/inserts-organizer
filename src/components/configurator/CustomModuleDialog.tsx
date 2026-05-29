import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { useConfigurator, type ModuleEditValues } from "@/lib/configurator-store";
import {
  DEFAULT_DEPTH_MM,
  DEFAULT_WALL_MM,
  DIM_STEP_MM,
  formatMm,
  getModule,
  nextCustomColor,
  roundDim,
} from "@/lib/insert-types";
import {
  clampAllFingerSlots,
  cloneFingerSlots,
  createDefaultFingerSlots,
  resolveFingerSlots,
} from "@/lib/finger-slots";
import { FingerSlotsPanel } from "./FingerSlotsPanel";
import { RampConfigPanel } from "./RampConfigPanel";
import {
  clampRampConfig,
  cloneRampConfig,
  createDefaultRampConfig,
  resolveRampConfig,
  type RampConfig,
} from "@/lib/ramp-config";

interface ModuleFormDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  submitLabel: string;
  initial?: Partial<ModuleEditValues>;
  onSubmit: (values: ModuleEditValues) => void;
}

function ModuleFormDialog({
  trigger,
  title,
  description,
  submitLabel,
  initial,
  onSubmit,
}: ModuleFormDialogProps) {
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [width, setWidth] = useState<number | "">(initial?.width ?? 60);
  const [height, setHeight] = useState<number | "">(initial?.height ?? 60);
  const [depth, setDepth] = useState<number | "">(initial?.depth ?? DEFAULT_DEPTH_MM);
  const [wallThickness, setWallThickness] = useState<number | "">(
    initial?.wallThickness ?? DEFAULT_WALL_MM,
  );
  const [fingerSlots, setFingerSlots] = useState(
    () => cloneFingerSlots(initial?.fingerSlots ?? createDefaultFingerSlots()),
  );
  const [rampConfig, setRampConfig] = useState<RampConfig>(
    () => cloneRampConfig(initial?.rampConfig ?? createDefaultRampConfig()),
  );
  const [error, setError] = useState<string | null>(null);

  const w = typeof width === "number" ? width : 0;
  const h = typeof height === "number" ? height : 0;
  const d = typeof depth === "number" ? depth : 0;
  const t = typeof wallThickness === "number" ? wallThickness : 0;
  const reset = () => {
    setName(initial?.name ?? "");
    setWidth(initial?.width ?? 60);
    setHeight(initial?.height ?? 60);
    setDepth(initial?.depth ?? DEFAULT_DEPTH_MM);
    setWallThickness(initial?.wallThickness ?? DEFAULT_WALL_MM);
    setFingerSlots(cloneFingerSlots(initial?.fingerSlots ?? createDefaultFingerSlots()));
    setRampConfig(cloneRampConfig(initial?.rampConfig ?? createDefaultRampConfig()));
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    const rw = roundDim(w);
    const rh = roundDim(h);
    const rd = roundDim(d);
    const rt = roundDim(t);
    if (rw < 10 || rh < 10) return setError("Minimum footprint is 10mm.");
    if (rw > boxWidth || rh > boxHeight)
      return setError(`Maximum footprint is ${formatMm(boxWidth)}×${formatMm(boxHeight)}mm.`);
    if (rd < 5) return setError("Minimum depth is 5mm.");
    if (rd > boxDepth) return setError(`Maximum depth is ${formatMm(boxDepth)}mm.`);
    if (rt < 0.5) return setError("Minimum wall thickness is 0.5mm.");
    if (rt > 10) return setError("Maximum wall thickness is 10mm.");
    if (2 * rt >= rw || 2 * rt >= rh) return setError("Walls are too thick for this footprint.");
    onSubmit({
      name: name.trim(),
      width: rw,
      height: rh,
      depth: rd,
      wallThickness: rt,
      fingerSlots: clampAllFingerSlots(fingerSlots, rw, rh, rd),
      rampConfig: clampRampConfig(rampConfig, rd, rt),
    });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass-panel max-h-[90vh] overflow-y-auto border-panel-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dice Tower Slot"
              className="w-full rounded-md border border-panel-border bg-card/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Width (mm)">
              <NumberInput value={width} onChange={setWidth} min={10} max={boxWidth} />
            </Field>
            <Field label="Height (mm)">
              <NumberInput value={height} onChange={setHeight} min={10} max={boxHeight} />
            </Field>
            <Field label="Depth (mm)">
              <NumberInput value={depth} onChange={setDepth} min={5} max={boxDepth} />
            </Field>
            <Field label="Wall (mm)">
              <NumberInput
                value={wallThickness}
                onChange={setWallThickness}
                min={0.5}
                max={10}
                step={DIM_STEP_MM}
              />
            </Field>
          </div>

          <FingerSlotsPanel
            fingerSlots={fingerSlots}
            moduleWidth={w}
            moduleHeight={h}
            moduleDepth={d}
            onChange={setFingerSlots}
          />

          <RampConfigPanel
            rampConfig={rampConfig}
            moduleDepth={d}
            wallThickness={t}
            onChange={setRampConfig}
          />

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-panel-border bg-card/40 px-4 py-2 text-sm text-foreground transition-colors hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-glow rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform active:scale-95"
            >
              {submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = DIM_STEP_MM,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  min: number;
  max: number;
  step?: number;
}) {
  const commit = (raw: string) => {
    if (raw === "") {
      onChange("");
      return;
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, roundDim(n)));
    onChange(clamped);
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "" || raw === "-") {
          onChange("");
          return;
        }
        const n = Number(raw.replace(",", "."));
        if (!Number.isFinite(n)) return;
        onChange(Math.max(min, Math.min(max, n)));
      }}
      onBlur={(e) => commit(e.target.value)}
      className="w-full rounded-md border border-panel-border bg-card/60 px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-primary/60"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---------------- Public dialog wrappers ---------------- */

export function CustomModuleDialog({ compact = false }: { compact?: boolean }) {
  const addCustomModule = useConfigurator((s) => s.addCustomModule);
  const customCount = useConfigurator((s) => s.customModules.length);

  return (
    <ModuleFormDialog
      trigger={
        compact ? (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md border border-dashed border-[#f97316]/50 px-2 py-1 text-[10px] font-medium text-[#f97316] transition-colors hover:border-[#f97316] hover:bg-[#20110b]"
            title="Dodaj własny moduł"
          >
            <Plus className="h-3 w-3" />
            Własny
          </button>
        ) : (
          <button
            type="button"
            className="mt-1 w-full rounded-xl border border-dashed border-[var(--spatial-accent-muted)] py-2.5 text-xs font-medium text-[var(--spatial-accent)] transition-colors hover:bg-[var(--spatial-accent-soft)]"
          >
            + Dodaj własny moduł
          </button>
        )
      }
      title="Custom Module"
      description="Define footprint and depth for a bespoke insert tray."
      submitLabel="Create Module"
      onSubmit={(values) => addCustomModule({ ...values, color: nextCustomColor(customCount) })}
    />
  );
}

export function EditCustomModuleButton({ moduleId }: { moduleId: string }) {
  const m = getModule(moduleId);
  const updateCustomModule = useConfigurator((s) => s.updateCustomModule);

  return (
    <ModuleFormDialog
      trigger={
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-card/80 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          aria-label="Edit module"
        >
          <Pencil className="h-3 w-3" />
        </button>
      }
      title={`Edit · ${m.name}`}
      description="Adjust dimensions or rename. All placed instances will update."
      submitLabel="Save Changes"
      initial={{
        name: m.name,
        width: m.width,
        height: m.height,
        depth: m.depth,
        wallThickness: m.wallThickness,
        fingerSlots: cloneFingerSlots(m.fingerSlots ?? createDefaultFingerSlots()),
        rampConfig: cloneRampConfig(m.rampConfig ?? createDefaultRampConfig()),
      }}
      onSubmit={(values) => updateCustomModule(moduleId, values)}
    />
  );
}

export function EditPlacedModuleButton({ instanceId }: { instanceId: string }) {
  const placed = useConfigurator((s) => s.placed.find((p) => p.instanceId === instanceId));
  const editPlacedModule = useConfigurator((s) => s.editPlacedModule);
  if (!placed) return null;
  const m = getModule(placed.moduleId);

  return (
    <ModuleFormDialog
      trigger={
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-card text-foreground shadow-lg hover:bg-primary hover:text-primary-foreground"
          aria-label="Edit module"
        >
          <Pencil className="h-3 w-3" />
        </button>
      }
      title={`Edit · ${m.name}`}
      description={
        m.type === "custom"
          ? "Adjust this custom module. All placed instances will update."
          : "Editing a built-in spawns a custom variant for this instance."
      }
      submitLabel="Save Changes"
      initial={{
        name: m.name,
        width: m.width,
        height: m.height,
        depth: m.depth,
        wallThickness: m.wallThickness,
        fingerSlots: cloneFingerSlots(resolveFingerSlots(placed, m)),
        rampConfig: cloneRampConfig(resolveRampConfig(placed, m, m.depth, m.wallThickness)),
      }}
      onSubmit={(values) => editPlacedModule(instanceId, values)}
    />
  );
}
