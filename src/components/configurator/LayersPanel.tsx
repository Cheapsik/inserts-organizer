import { formatMm } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-context";
import { maxLayerCount, resolveLayerHeight } from "@/lib/layer-utils";

export function LayersPanel() {
  const layers = useConfigurator((s) => s.layers);
  const activeLayerId = useConfigurator((s) => s.activeLayerId);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const setActiveLayerId = useConfigurator((s) => s.setActiveLayerId);
  const addLayer = useConfigurator((s) => s.addLayer);

  const atMax = layers.length >= maxLayerCount(boxDepth);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--spatial-accent)]">
          Warstwy
        </h3>
        <button
          type="button"
          disabled={atMax}
          onClick={() => addLayer()}
          className="text-[10px] text-[var(--spatial-accent)] hover:underline disabled:opacity-30"
        >
          + Dodaj
        </button>
      </div>

      {layers.map((layer, i) => {
        const resolvedHeight = resolveLayerHeight(layer);
        const isActive = layer.id === activeLayerId;
        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => setActiveLayerId(layer.id)}
            className={`flex w-full items-center justify-between rounded-lg p-2 transition-colors ${
              isActive
                ? "border border-[var(--spatial-accent-border)] bg-[var(--spatial-accent-soft)]"
                : "border border-transparent bg-transparent hover:bg-[var(--spatial-surface)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--spatial-accent)] text-[10px] font-bold text-black">
                {i + 1}
              </span>
              <span className="text-xs text-[var(--spatial-text-body)]">{layer.name}</span>
            </div>
            <span className="font-mono text-[11px] text-[var(--spatial-text-muted)]">
              {formatMm(resolvedHeight)}mm
            </span>
          </button>
        );
      })}
    </div>
  );
}
