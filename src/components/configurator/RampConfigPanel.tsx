import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { clampRampConfig, type RampConfig, type RampWall } from "@/lib/ramp-config";
import { formatMm } from "@/lib/insert-types";

const WALL_OPTIONS: {
  wall: RampWall;
  label: string;
  Icon: typeof ArrowDown;
  iconClass: string;
}[] = [
  { wall: "top", label: "Top", Icon: ArrowDown, iconClass: "rotate-0" },
  { wall: "bottom", label: "Bottom", Icon: ArrowUp, iconClass: "rotate-0" },
  { wall: "left", label: "Left", Icon: ArrowRight, iconClass: "rotate-0" },
  { wall: "right", label: "Right", Icon: ArrowLeft, iconClass: "rotate-0" },
];

interface RampConfigPanelProps {
  rampConfig: RampConfig;
  moduleDepth: number;
  wallThickness: number;
  onChange: (config: RampConfig) => void;
}

export function RampConfigPanel({
  rampConfig,
  moduleDepth,
  wallThickness,
  onChange,
}: RampConfigPanelProps) {
  const maxH = Math.max(5, moduleDepth - wallThickness);
  const clamped = clampRampConfig(rampConfig, moduleDepth, wallThickness);

  const update = (patch: Partial<RampConfig>) => {
    onChange(clampRampConfig({ ...rampConfig, ...patch }, moduleDepth, wallThickness));
  };

  return (
    <Accordion type="single" collapsible className="rounded-lg border border-panel-border bg-card/40">
      <AccordionItem value="ramp-config" className="border-none">
        <AccordionTrigger className="px-3 py-2.5 text-sm hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <span className="font-medium text-foreground">Internal Bottom Ramp</span>
            {clamped.enabled && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-primary capitalize">
                {clamped.wall} · {formatMm(clamped.startHeight)} mm
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 px-3 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Enable Ramp</div>
              <div className="text-[11px] text-muted-foreground">
                Slopes from the high wall down to the opposite floor edge.
              </div>
            </div>
            <Switch checked={clamped.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          </div>

          {clamped.enabled && (
            <>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  High Wall
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {WALL_OPTIONS.map(({ wall, label, Icon, iconClass }) => {
                    const active = clamped.wall === wall;
                    return (
                      <button
                        key={wall}
                        type="button"
                        onClick={() => update({ wall })}
                        className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] font-medium transition-colors ${
                          active
                            ? "border-primary/60 bg-primary/15 text-primary"
                            : "border-panel-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${iconClass}`} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ramp Height (mm)
                </span>
                <input
                  type="number"
                  min={5}
                  max={maxH}
                  step={0.5}
                  value={clamped.startHeight}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    update({ startHeight: Math.max(5, Math.min(maxH, n)) });
                  }}
                  className="w-full rounded-md border border-panel-border bg-card/60 px-2.5 py-1.5 font-mono text-sm text-foreground outline-none focus:border-primary/60"
                />
                <span className="text-[10px] text-muted-foreground">
                  Max {formatMm(maxH)} mm (module depth − wall)
                </span>
              </label>
            </>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
