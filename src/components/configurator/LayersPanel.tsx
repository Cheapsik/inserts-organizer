import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMm } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-context";
import {
  layerAccentColor,
  maxLayerCount,
  resolveLayerHeight,
  type InsertLayer,
} from "@/lib/layer-utils";

export function LayersPanel() {
  const layers = useConfigurator((s) => s.layers);
  const activeLayerId = useConfigurator((s) => s.activeLayerId);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const overflowingLayerIds = useConfigurator((s) => s.overflowingLayerIds);
  const setActiveLayerId = useConfigurator((s) => s.setActiveLayerId);
  const addLayer = useConfigurator((s) => s.addLayer);
  const removeLayer = useConfigurator((s) => s.removeLayer);
  const moveLayerUp = useConfigurator((s) => s.moveLayerUp);
  const moveLayerDown = useConfigurator((s) => s.moveLayerDown);
  const renameLayer = useConfigurator((s) => s.renameLayer);
  const setLayerHeightMode = useConfigurator((s) => s.setLayerHeightMode);
  const setLayerManualHeight = useConfigurator((s) => s.setLayerManualHeight);

  const atMax = layers.length >= maxLayerCount(boxDepth);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-[200px] max-h-[min(320px,44vh)] flex-[2] flex-col border-t border-panel-border">
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">Layers</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={atMax}
                onClick={() => addLayer()}
                className="flex items-center gap-1 rounded-md border border-dashed border-panel-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </TooltipTrigger>
            {atMax && (
              <TooltipContent side="top">
                <p>Box is full!</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-2.5">
          <div className="space-y-1.5">
            {layers.map((layer, index) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                index={index}
                isActive={layer.id === activeLayerId}
                isStackOverflow={overflowingLayerIds.includes(layer.id)}
                accent={layerAccentColor(index)}
                boxDepth={boxDepth}
                canMoveUp={index > 0}
                canMoveDown={index < layers.length - 1}
                canDelete={layers.length > 1}
                onSelect={() => setActiveLayerId(layer.id)}
                onMoveUp={() => moveLayerUp(layer.id)}
                onMoveDown={() => moveLayerDown(layer.id)}
                onDelete={() => removeLayer(layer.id)}
                onRename={(name) => renameLayer(layer.id, name)}
                onHeightMode={(mode) => setLayerHeightMode(layer.id, mode)}
                onManualHeight={(h) => setLayerManualHeight(layer.id, h)}
              />
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function LayerRow({
  layer,
  isActive,
  isStackOverflow,
  accent,
  boxDepth,
  canMoveUp,
  canMoveDown,
  canDelete,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRename,
  onHeightMode,
  onManualHeight,
}: {
  layer: InsertLayer;
  index: number;
  isActive: boolean;
  isStackOverflow: boolean;
  accent: string;
  boxDepth: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onHeightMode: (mode: "auto" | "manual") => void;
  onManualHeight: (h: number) => void;
}) {
  const resolved = resolveLayerHeight(layer);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setNameDraft(layer.name);
  }, [layer.name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onRename(trimmed);
    else setNameDraft(layer.name);
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`rounded-lg border transition-colors ${
        isStackOverflow ? "border-destructive/50" : "border-panel-border"
      } ${isActive ? "bg-primary/10 ring-1 ring-primary/40" : "bg-card/40 hover:bg-card/60"}`}
      style={isActive ? { boxShadow: `inset 2px 0 0 ${accent}` } : undefined}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <div className="flex shrink-0 flex-col" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label="Move layer up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25"
            aria-label="Move layer down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-w-0 flex-1" onDoubleClick={(e) => e.stopPropagation()}>
          {editing ? (
            <input
              ref={inputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setNameDraft(layer.name);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-primary/50 bg-card px-1.5 py-0.5 text-xs text-foreground outline-none"
            />
          ) : (
            <span
              className="block truncate text-xs font-medium text-foreground"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              {layer.name}
            </span>
          )}
        </div>

        <span
          className={`shrink-0 font-mono text-[10px] ${
            isStackOverflow ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {formatMm(resolved)}mm
        </span>

        <button
          type="button"
          disabled={!canDelete}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-25"
          aria-label="Delete layer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="flex items-center gap-2 border-t border-panel-border/50 px-2 py-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex rounded border border-panel-border text-[10px]">
          <button
            type="button"
            onClick={() => onHeightMode("auto")}
            className={`px-2 py-0.5 ${
              layer.heightMode === "auto"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground"
            }`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => onHeightMode("manual")}
            className={`px-2 py-0.5 ${
              layer.heightMode === "manual"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground"
            }`}
          >
            Man
          </button>
        </div>
        {layer.heightMode === "manual" && (
          <input
            type="number"
            min={1}
            max={boxDepth}
            step={1}
            value={layer.manualHeight ?? resolved}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (Number.isFinite(n)) onManualHeight(n);
            }}
            className="w-12 rounded border border-panel-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground outline-none"
            aria-label="Manual layer height in mm"
          />
        )}
      </div>
    </div>
  );
}
