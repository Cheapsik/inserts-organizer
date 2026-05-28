import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  clampDividerPosition,
  getDividerDisplayRect,
  getModuleWallThickness,
  pointerDeltaToLocalPositionDelta,
} from "@/lib/module-dividers";
import { formatMm, getModule, type ModuleDivider, type PlacedModule } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-store";

interface Props {
  placed: PlacedModule;
  pxPerMm: number;
  disabled?: boolean;
}

export function ModuleDividers({ placed, pxPerMm, disabled }: Props) {
  const m = getModule(placed.moduleId);
  const wallT = getModuleWallThickness(placed);
  const dividers = useMemo(() => placed.dividers ?? [], [placed.dividers]);

  const selectedDivider = useConfigurator((s) => s.selectedDivider);
  const updateDivider = useConfigurator((s) => s.updateDivider);
  const removeDivider = useConfigurator((s) => s.removeDivider);
  const setSelectedDivider = useConfigurator((s) => s.setSelectedDivider);

  const [dragState, setDragState] = useState<{
    dividerId: string;
    startPosition: number;
    startClientX: number;
    startClientY: number;
    livePosition: number;
  } | null>(null);

  const rafRef = useRef<number | null>(null);
  const pendingPosRef = useRef<number | null>(null);

  const flushPosition = useCallback(
    (dividerId: string, position: number) => {
      updateDivider(placed.instanceId, dividerId, { position });
    },
    [placed.instanceId, updateDivider],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, divider: ModuleDivider) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedDivider({ instanceId: placed.instanceId, dividerId: divider.id });
    setDragState({
      dividerId: divider.id,
      startPosition: divider.position,
      startClientX: e.clientX,
      startClientY: e.clientY,
      livePosition: divider.position,
    });
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragState) return;
      const divider = dividers.find((d) => d.id === dragState.dividerId);
      if (!divider) return;

      const delta = pointerDeltaToLocalPositionDelta(
        divider,
        placed.rotation,
        e.clientX - dragState.startClientX,
        e.clientY - dragState.startClientY,
        pxPerMm,
      );
      const next = clampDividerPosition(
        divider.orientation,
        dragState.startPosition + delta,
        m.width,
        m.height,
        wallT,
      );

      pendingPosRef.current = next;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingPosRef.current == null) return;
          const live = pendingPosRef.current;
          setDragState((prev) => (prev ? { ...prev, livePosition: live } : null));
        });
      }
    },
    [dragState, dividers, m.height, m.width, placed.rotation, pxPerMm, wallT],
  );

  const endDrag = useCallback(() => {
    if (!dragState) return;
    flushPosition(dragState.dividerId, dragState.livePosition);
    setDragState(null);
    pendingPosRef.current = null;
  }, [dragState, flushPosition]);

  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [dragState, endDrag, onPointerMove]);

  const isSelected = (id: string) =>
    selectedDivider?.instanceId === placed.instanceId && selectedDivider.dividerId === id;

  return (
    <>
      {dividers.map((divider) => {
        const position =
          dragState?.dividerId === divider.id ? dragState.livePosition : divider.position;
        const rect = getDividerDisplayRect(
          { ...divider, position },
          m.width,
          m.height,
          placed.rotation,
          wallT,
        );
        const selected = isSelected(divider.id);

        return (
          <div key={divider.id} className="pointer-events-none absolute inset-0">
            <div
              role="separator"
              aria-orientation={divider.orientation === "horizontal" ? "horizontal" : "vertical"}
              className={`pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing ${
                selected
                  ? "bg-sky-300 shadow-[0_0_8px_oklch(0.72_0.18_255/0.9)]"
                  : "bg-white/75 hover:bg-sky-200/90"
              }`}
              style={{
                left: rect.left * pxPerMm,
                top: rect.top * pxPerMm,
                width: Math.max(rect.width * pxPerMm, 2),
                height: Math.max(rect.height * pxPerMm, 2),
                zIndex: 15,
              }}
              onPointerDown={(e) => startDrag(e, divider)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDivider({
                  instanceId: placed.instanceId,
                  dividerId: divider.id,
                });
              }}
            />
            {selected && !dragState && (
              <DividerPopover
                divider={divider}
                pxPerMm={pxPerMm}
                rect={rect}
                onHeightChange={(height) =>
                  updateDivider(placed.instanceId, divider.id, { height })
                }
                onDelete={() => removeDivider(placed.instanceId, divider.id)}
                onClose={() => setSelectedDivider(null)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function DividerPopover({
  divider,
  pxPerMm,
  rect,
  onHeightChange,
  onDelete,
  onClose,
}: {
  divider: ModuleDivider;
  pxPerMm: number;
  rect: { left: number; top: number; width: number; height: number };
  onHeightChange: (h: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(String(divider.height));

  useEffect(() => setLocal(String(divider.height)), [divider.height]);

  const popLeft = (rect.left + rect.width / 2) * pxPerMm;
  const popTop = (rect.top + rect.height) * pxPerMm + 6;

  return (
    <div
      className="pointer-events-auto absolute z-40 min-w-[140px] rounded-lg border border-panel-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md"
      style={{ left: popLeft, top: popTop, transform: "translateX(-50%)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Divider · {divider.orientation === "horizontal" ? "H" : "V"}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-foreground">
        <span className="text-muted-foreground">Height</span>
        <input
          type="number"
          min={5}
          step={0.1}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(local.replace(",", "."));
            if (Number.isFinite(n)) onHeightChange(n);
            else setLocal(String(divider.height));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            if (e.key === "Escape") onClose();
          }}
          className="w-16 rounded border border-panel-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none focus:border-primary/60"
        />
        <span className="font-mono text-[10px] text-muted-foreground">mm</span>
      </label>
      <div className="mt-1 font-mono text-[9px] text-muted-foreground/80">
        Pos {formatMm(divider.position)} mm
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
      >
        <Trash2 className="h-3 w-3" />
        Remove
      </button>
    </div>
  );
}
