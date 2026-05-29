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
  const barH = 180;
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 backdrop-blur-xl">
      <span className="font-mono-prz text-[9px] uppercase tracking-[0.2em] text-slate-500">Stos</span>
      <div
        className="relative w-4 rounded-full border border-white/10 bg-black/20"
        style={{ height: barH }}
        title={`${formatMm(stackHeight)} / ${formatMm(boxDepth)} mm`}
      >
        {segments.map((seg) =>
          seg.h > 0 ? (
            <div
              key={seg.layer.id}
              className="absolute left-0.5 right-0.5 rounded-full transition-all"
              style={{
                bottom: seg.bottom,
                height: seg.h,
                background: seg.isOverflow ? "var(--destructive)" : seg.color,
                opacity: seg.isOverflow ? 0.9 : 0.85,
                boxShadow: seg.isOverflow ? undefined : `0 0 6px ${seg.color}66`,
              }}
            />
          ) : null,
        )}
        {overflowPx > 0 && (
          <div
            className="absolute left-0.5 right-0.5 rounded-full bg-destructive"
            style={{ bottom: barH, height: overflowPx }}
          />
        )}
      </div>
      <span className={`font-mono-prz text-[10px] ${overflow ? "text-red-400" : "text-[#ff6b00]"}`}>
        {formatMm(stackHeight)}
      </span>
    </div>
  );
}
