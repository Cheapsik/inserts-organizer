import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  clampAllFingerSlots,
  clampFingerSlot,
  createDefaultFingerSlots,
  getWallLengthMm,
  hasAnyFingerSlot,
  type FingerSlotConfig,
  type FingerSlotWallKey,
  type FingerSlotsConfig,
} from "@/lib/finger-slots";
import { formatMm } from "@/lib/insert-types";

const WALL_LABELS: Record<FingerSlotWallKey, string> = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

interface FingerSlotsPanelProps {
  fingerSlots: FingerSlotsConfig;
  moduleWidth: number;
  moduleHeight: number;
  moduleDepth: number;
  onChange: (slots: FingerSlotsConfig) => void;
}

export function FingerSlotsPanel({
  fingerSlots,
  moduleWidth,
  moduleHeight,
  moduleDepth,
  onChange,
}: FingerSlotsPanelProps) {
  const enabledCount = (Object.keys(WALL_LABELS) as FingerSlotWallKey[]).filter(
    (wall) => fingerSlots[wall].enabled,
  ).length;

  const updateWall = (wall: FingerSlotWallKey, patch: Partial<FingerSlotConfig>) => {
    const next = clampAllFingerSlots(
      {
        ...fingerSlots,
        [wall]: { ...fingerSlots[wall], ...patch },
      },
      moduleWidth,
      moduleHeight,
      moduleDepth,
    );
    onChange(next);
  };

  return (
    <Accordion type="single" collapsible className="rounded-lg border border-panel-border bg-card/40">
      <AccordionItem value="finger-slots" className="border-none">
        <AccordionTrigger className="px-3 py-2.5 text-sm hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <span className="font-medium text-foreground">Finger Slots</span>
            {enabledCount > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                {enabledCount} active
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <Tabs defaultValue="top" className="w-full">
            <TabsList className="mb-3 grid h-8 w-full grid-cols-4 bg-muted/60 p-0.5">
              {(Object.keys(WALL_LABELS) as FingerSlotWallKey[]).map((wall) => (
                <TabsTrigger
                  key={wall}
                  value={wall}
                  className="h-7 px-1 text-[10px] data-[state=active]:bg-background"
                >
                  {WALL_LABELS[wall]}
                  {fingerSlots[wall].enabled && (
                    <span className="ml-0.5 inline-block h-1 w-1 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(WALL_LABELS) as FingerSlotWallKey[]).map((wall) => (
              <TabsContent key={wall} value={wall} className="mt-0 space-y-3">
                <WallSlotEditor
                  wall={wall}
                  slot={fingerSlots[wall]}
                  moduleWidth={moduleWidth}
                  moduleHeight={moduleHeight}
                  moduleDepth={moduleDepth}
                  onChange={(patch) => updateWall(wall, patch)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function WallSlotEditor({
  wall,
  slot,
  moduleWidth,
  moduleHeight,
  moduleDepth,
  onChange,
}: {
  wall: FingerSlotWallKey;
  slot: FingerSlotConfig;
  moduleWidth: number;
  moduleHeight: number;
  moduleDepth: number;
  onChange: (patch: Partial<FingerSlotConfig>) => void;
}) {
  const wallLen = getWallLengthMm(wall, moduleWidth, moduleHeight);
  const clamped = clampFingerSlot(slot, wall, moduleWidth, moduleHeight, moduleDepth);
  const maxDepth = Math.max(5, moduleDepth);
  const maxWidth = Math.max(10, wallLen);

  return (
    <div className="space-y-3 rounded-md border border-panel-border/60 bg-card/30 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-foreground">Enable {WALL_LABELS[wall]} Wall Slot</div>
          <div className="text-[10px] text-muted-foreground">Wall length: {formatMm(wallLen)} mm</div>
        </div>
        <Switch
          checked={slot.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </div>

      {slot.enabled && (
        <>
          <SlotField
            label={`Depth (mm) — max ${formatMm(maxDepth)}`}
            value={clamped.depth}
            min={5}
            max={maxDepth}
            step={0.5}
            onChange={(depth) => onChange({ depth })}
          />
          <SlotField
            label={`Width (mm) — max ${formatMm(maxWidth)}`}
            value={clamped.width}
            min={10}
            max={maxWidth}
            step={1}
            onChange={(width) => onChange({ width })}
          />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Offset Position (%)
              </span>
              <span className="font-mono text-xs text-foreground">{Math.round(clamped.position)}%</span>
            </div>
            <Slider
              min={10}
              max={90}
              step={1}
              value={[clamped.position]}
              onValueChange={([position]) => onChange({ position })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function SlotField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-16 rounded border border-panel-border bg-card/60 px-2 py-0.5 text-right font-mono text-xs text-foreground outline-none focus:border-primary/60"
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export { createDefaultFingerSlots, hasAnyFingerSlot };
