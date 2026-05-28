import { formatMm } from "@/lib/insert-types";
import { layerAccentColor } from "@/lib/layer-utils";

interface Props {
  boxDepth: number;
  layers: { id: string; name: string }[];
  resolvedHeights: number[];
  overflowingLayerIds: string[];
  stackHeight: number;
}

export function StackHeightBar({
  boxDepth,
  layers,
  resolvedHeights,
  overflowingLayerIds,
  stackHeight,
}: Props) {
  const barH = 160;
  const scale = boxDepth > 0 ? barH / boxDepth : 1;
  const overflow = stackHeight > boxDepth;
  let offset = 0;

  const segments = layers.map((layer, i) => {
    const h = resolvedHeights[i] ?? 0;
    const segH = h * scale;
    const isOverflow = overflowingLayerIds.includes(layer.id);
    const bottom = offset;
    offset += segH;
    return {
      layer,
      h: segH,
      bottom,
      color: layerAccentColor(i),
      isOverflow,
    };
  });

  const overflowPx = overflow ? (stackHeight - boxDepth) * scale : 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        Stack
      </span>
      <div
        className="relative w-5 rounded-md border border-white/15 bg-muted/30"
        style={{ height: barH }}
        title={`${formatMm(stackHeight)} / ${formatMm(boxDepth)} mm`}
      >
        {segments.map((seg) =>
          seg.h > 0 ? (
            <div
              key={seg.layer.id}
              className="absolute left-0 right-0 rounded-sm transition-all"
              style={{
                bottom: seg.bottom,
                height: seg.h,
                background: seg.isOverflow ? "var(--destructive)" : seg.color,
                opacity: seg.isOverflow ? 0.9 : 0.75,
              }}
              title={`${seg.layer.name}: ${formatMm(resolvedHeights[layers.indexOf(seg.layer)] ?? 0)}mm`}
            />
          ) : null,
        )}
        {overflowPx > 0 && (
          <div
            className="absolute left-0 right-0 rounded-sm bg-destructive opacity-90"
            style={{
              bottom: barH,
              height: overflowPx,
              boxShadow: "0 0 12px var(--destructive)",
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />
      </div>
      <span
        className={`font-mono text-[9px] ${overflow ? "text-destructive" : "text-muted-foreground"}`}
      >
        {formatMm(stackHeight)}
      </span>
    </div>
  );
}
