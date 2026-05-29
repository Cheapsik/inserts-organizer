import { CheckCircle2, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useConfigurator } from "@/lib/configurator-context";
import { formatMm, getModule } from "@/lib/insert-types";

export function SummaryPanel() {
  const placed = useConfigurator((s) => s.placed);
  const allPlaced = useConfigurator((s) => s.allPlaced);
  const autoPack = useConfigurator((s) => s.autoPack);
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const stackHeight = useConfigurator((s) => s.stackHeight);
  const stackOverflow = useConfigurator((s) => s.stackOverflow);
  const hasDepthOverflow = useConfigurator((s) => s.hasDepthOverflow);

  const handleAutoPack = () => {
    if (placed.length === 0) {
      toast("Brak modułów do ułożenia.");
      return;
    }
    const { unpackedCount } = autoPack();
    if (unpackedCount > 0) {
      toast.error("Nie wszystkie moduły się mieszczą!");
    } else {
      toast.success("Układ ułożony.");
    }
  };

  const handleAddToCart = () => {
    toast.info("Dodawanie do koszyka — funkcja dostępna w sklepie.");
  };

  const usedArea = allPlaced.reduce((s, p) => {
    const m = getModule(p.moduleId);
    return s + m.width * m.height;
  }, 0);
  const boxArea = boxWidth * boxHeight;
  const utilization = Math.min(100, boxArea > 0 ? Math.round((usedArea / boxArea) * 100) : 0);
  const hasOverlaps = allPlaced.some((p) => p.isOverlapping);
  const hasOutOfBounds = allPlaced.some((p) => p.isOutOfBounds);
  const isValid =
    allPlaced.length > 0 && !stackOverflow && !hasDepthOverflow && !hasOverlaps && !hasOutOfBounds;

  return (
    <>
      <div>
        <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--spatial-accent)]">
          Podsumowanie
        </h3>
        <p className="text-xl font-bold text-[var(--spatial-text-primary)]">Twoja konfiguracja</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--spatial-surface-border)] bg-[var(--spatial-surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--spatial-text-muted)]">Moduły</p>
          <p className="text-lg font-bold text-[var(--spatial-text-primary)]">{allPlaced.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--spatial-surface-border)] bg-[var(--spatial-surface)] p-3">
          <p className="text-[10px] uppercase text-[var(--spatial-text-muted)]">Stos</p>
          <p
            className={`text-lg font-bold ${stackOverflow ? "text-[#f87171]" : "text-[#4ade80]"}`}
          >
            {formatMm(stackHeight)}/{formatMm(boxDepth)}mm
          </p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[10px] text-[var(--spatial-text-muted)]">
          <span>Wykorzystanie powierzchni</span>
          <span>{utilization}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--spatial-surface-border)]">
          <div
            className="h-full rounded-full bg-[var(--spatial-accent)] transition-all duration-500"
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>

      <div
        className={`flex items-center gap-2 rounded-lg p-2.5 ${
          isValid
            ? "border border-green-500/20 bg-green-500/5 text-[#4ade80]"
            : "border border-red-500/20 bg-red-500/5 text-[#f87171]"
        }`}
      >
        <CheckCircle2 size={14} />
        <span className="text-xs">{isValid ? "Układ poprawny" : "Wykryto kolizje"}</span>
      </div>

      <button
        type="button"
        onClick={handleAutoPack}
        className="group flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--spatial-surface-border)] bg-[var(--spatial-surface)] py-2.5 text-xs font-medium text-[var(--spatial-text-body)] transition-all hover:bg-[var(--spatial-surface-hover)] hover:shadow-[0_0_12px_rgba(255,140,0,0.2)]"
      >
        <Sparkles size={14} className="transition-colors group-hover:text-[var(--spatial-accent)]" />
        Auto-układ
      </button>

      <button
        type="button"
        onClick={handleAddToCart}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ffb347] py-3 text-sm font-bold text-black shadow-[0_0_25px_rgba(255,107,0,0.4)] transition-shadow hover:shadow-[0_0_40px_rgba(255,107,0,0.6)]"
      >
        <ShoppingCart size={16} />
        Dodaj do koszyka
      </button>
    </>
  );
}
