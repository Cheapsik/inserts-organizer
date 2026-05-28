import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Link2Off, Minus, RotateCw, SeparatorVertical, X } from "lucide-react";
import { getDragRenderPosition } from "@/lib/canvas-drag";
import { formatMm, getModule, getRotatedSize, type PlacedModule } from "@/lib/insert-types";
import {
  CANVAS_BG,
  hasAnyFingerSlot,
  localWallToCanvasEdge,
  resolveFingerSlots,
  type FingerSlotConfig,
  type FingerSlotWallKey,
  type FingerSlotsConfig,
} from "@/lib/finger-slots";
import { resolveRampConfig, rampGradientAngleCss, type RampConfig } from "@/lib/ramp-config";
import { useConfigurator } from "@/lib/configurator-store";
import { groupColorFromId } from "@/lib/merge-groups";
import { EditPlacedModuleButton } from "./CustomModuleDialog";
import { ModuleDividers } from "./ModuleDividers";

interface Props {
  placed: PlacedModule;
  pxPerMm: number;
}

export function PlacedModuleItem({ placed, pxPerMm }: Props) {
  const m = getModule(placed.moduleId);
  const { w, h } = getRotatedSize(m, placed.rotation);
  const rotate = useConfigurator((s) => s.rotateModule);
  const remove = useConfigurator((s) => s.removeModule);
  const addDivider = useConfigurator((s) => s.addDivider);
  const canvasDrag = useConfigurator((s) => s.canvasDrag);
  const selectedInstanceIds = useConfigurator((s) => s.selectedInstanceIds);
  const hoveredGroupId = useConfigurator((s) => s.hoveredGroupId);
  const toggleSelection = useConfigurator((s) => s.toggleSelection);
  const selectSingle = useConfigurator((s) => s.selectSingle);
  const unmergeGroup = useConfigurator((s) => s.unmergeGroup);
  const setHoveredGroupId = useConfigurator((s) => s.setHoveredGroupId);
  const setSelectedDivider = useConfigurator((s) => s.setSelectedDivider);

  const isSelected = selectedInstanceIds.includes(placed.instanceId);
  const isGrouped = !!placed.groupId;
  const isGroupHovered = isGrouped && placed.groupId === hoveredGroupId;

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `placed-${placed.instanceId}`,
    data: { source: "canvas", instanceId: placed.instanceId, moduleId: placed.moduleId },
  });

  const isInActiveDrag = !!canvasDrag && canvasDrag.memberInstanceIds.includes(placed.instanceId);

  const renderPos = canvasDrag
    ? getDragRenderPosition(canvasDrag, placed.instanceId, {
        x: placed.x,
        y: placed.y,
      })
    : { x: placed.x, y: placed.y };

  const dragCollides = isInActiveDrag && canvasDrag?.collides;
  const isLeadDrag = canvasDrag?.leadInstanceId === placed.instanceId;
  const dividersDisabled = isInActiveDrag;

  const groupAccent = placed.groupId ? groupColorFromId(placed.groupId) : null;

  const style: React.CSSProperties = {
    position: "absolute",
    left: renderPos.x * pxPerMm,
    top: renderPos.y * pxPerMm,
    width: w * pxPerMm,
    height: h * pxPerMm,
    transition: isInActiveDrag
      ? "none"
      : "left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: isInActiveDrag
      ? 30
      : isSelected
        ? 25
        : placed.isOverlapping || placed.isOutOfBounds
          ? 20
          : 10,
    touchAction: "none",
    pointerEvents: isInActiveDrag && !isLeadDrag ? "none" : undefined,
  };

  const isInvalid = placed.isOverlapping || placed.isOutOfBounds || dragCollides;
  const baseColor = groupAccent ?? m.color;
  const fingerSlots = resolveFingerSlots(placed, m);
  const wallT = placed.wallThickness ?? m.wallThickness;
  const rampConfig = resolveRampConfig(placed, m, m.depth, wallT);
  const bg = isInvalid
    ? `linear-gradient(135deg, ${baseColor}55, ${baseColor}25)`
    : `linear-gradient(135deg, ${baseColor}50, ${baseColor}20)`;

  const borderClass = isSelected
    ? "border-sky-400 shadow-[0_0_0_1px_oklch(0.72_0.18_255/0.9),inset_0_0_20px_oklch(0.72_0.18_255/0.35)]"
    : dragCollides
      ? "border-destructive shadow-[0_0_24px_-2px_var(--destructive)]"
      : placed.isOutOfBounds
        ? "border-destructive shadow-[0_0_28px_-2px_var(--destructive)] animate-pulse"
        : placed.isOverlapping
          ? "border-destructive shadow-[0_0_24px_-2px_var(--destructive)]"
          : isGroupHovered
            ? "border-white/70 shadow-[0_0_18px_-2px_oklch(0.72_0.18_255/0.6)]"
            : isGrouped
              ? "border-white/40"
              : "border-white/25 hover:border-white/60";

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={`group cursor-grab rounded-md border-2 backdrop-blur-sm transition-shadow active:cursor-grabbing ${borderClass}`}
      onMouseEnter={() => placed.groupId && setHoveredGroupId(placed.groupId)}
      onMouseLeave={() => placed.groupId && setHoveredGroupId(null)}
    >
      <div
        {...listeners}
        {...attributes}
        className="relative h-full w-full overflow-visible rounded-[2px]"
        style={{ background: bg, boxShadow: `inset 0 0 0 1px ${baseColor}40` }}
        onDoubleClick={() => !isGrouped && rotate(placed.instanceId)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedDivider(null);
          if (e.shiftKey) toggleSelection(placed.instanceId);
          else selectSingle(placed.instanceId);
        }}
      >
        <ModuleDividers placed={placed} pxPerMm={pxPerMm} disabled={dividersDisabled} />

        {rampConfig.enabled && (
          <RampIndicator rampConfig={rampConfig} rotation={placed.rotation} baseColor={baseColor} />
        )}

        {hasAnyFingerSlot(fingerSlots) && (
          <FingerSlotIndicators
            fingerSlots={fingerSlots}
            rotation={placed.rotation}
            pxPerMm={pxPerMm}
          />
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-2 text-center">
          <div className="truncate text-[11px] font-semibold text-white drop-shadow">{m.name}</div>
          <div className="font-mono text-[10px] text-white/70">
            {formatMm(m.width)}×{formatMm(m.height)}mm
          </div>
          {(placed.dividers?.length ?? 0) > 0 && (
            <div className="font-mono text-[9px] text-white/50">
              {placed.dividers?.length ?? 0} div
            </div>
          )}
          {rampConfig.enabled && (
            <div className="font-mono text-[9px] text-white/60">
              ramp {rampConfig.wall} · {formatMm(rampConfig.startHeight)} mm
            </div>
          )}
          {isGrouped && (
            <div className="mt-0.5 rounded-sm bg-black/30 px-1 font-mono text-[8px] uppercase tracking-wider text-white/60">
              Glued
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute -top-3 -right-3 flex max-w-[calc(100%+24px)] flex-wrap justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            addDivider(placed.instanceId, "horizontal");
          }}
          className="pointer-events-auto flex h-6 items-center gap-0.5 rounded-full border border-white/20 bg-card px-1.5 text-[9px] font-medium text-foreground shadow-lg hover:bg-primary hover:text-primary-foreground"
          title="Add horizontal divider"
        >
          <Minus className="h-3 w-3" />H
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            addDivider(placed.instanceId, "vertical");
          }}
          className="pointer-events-auto flex h-6 items-center gap-0.5 rounded-full border border-white/20 bg-card px-1.5 text-[9px] font-medium text-foreground shadow-lg hover:bg-primary hover:text-primary-foreground"
          title="Add vertical divider"
        >
          <SeparatorVertical className="h-3 w-3" />V
        </button>
        {!isGrouped && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              rotate(placed.instanceId);
            }}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-card text-foreground shadow-lg hover:bg-primary hover:text-primary-foreground"
            aria-label="Rotate"
          >
            <RotateCw className="h-3 w-3" />
          </button>
        )}
        {isGrouped && placed.groupId && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              unmergeGroup(placed.groupId!);
            }}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-card text-sky-300 shadow-lg hover:bg-sky-500 hover:text-white"
            aria-label="Unmerge group"
            title="Unmerge"
          >
            <Link2Off className="h-3 w-3" />
          </button>
        )}
        <EditPlacedModuleButton instanceId={placed.instanceId} />
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            remove(placed.instanceId);
          }}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-card text-foreground shadow-lg hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Delete"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </motion.div>
  );
}

function RampIndicator({
  rampConfig,
  rotation,
  baseColor,
}: {
  rampConfig: RampConfig;
  rotation: 0 | 90 | 180 | 270;
  baseColor: string;
}) {
  const gradientDeg = rampGradientAngleCss(rotation, rampConfig.wall);
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2px]"
      style={{
        background: `linear-gradient(${gradientDeg}deg, ${baseColor}55 0%, ${baseColor}10 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `repeating-linear-gradient(
            ${gradientDeg + 45}deg,
            transparent,
            transparent 5px,
            ${baseColor}50 5px,
            ${baseColor}50 7px
          )`,
        }}
      />
    </div>
  );
}

function FingerSlotIndicators({
  fingerSlots,
  rotation,
  pxPerMm,
}: {
  fingerSlots: FingerSlotsConfig;
  rotation: 0 | 90 | 180 | 270;
  pxPerMm: number;
}) {
  const walls: FingerSlotWallKey[] = ["top", "bottom", "left", "right"];

  return (
    <>
      {walls.map((wall) => {
        const slot = fingerSlots[wall];
        if (!slot.enabled) return null;
        const canvasEdge = localWallToCanvasEdge(rotation, wall);
        return (
          <FingerSlotCutout key={wall} edge={canvasEdge} slot={slot} pxPerMm={pxPerMm} />
        );
      })}
    </>
  );
}

function FingerSlotCutout({
  edge,
  slot,
  pxPerMm,
}: {
  edge: FingerSlotWallKey;
  slot: FingerSlotConfig;
  pxPerMm: number;
}) {
  const widthPx = slot.width * pxPerMm;
  const radiusPx = widthPx / 2;
  const straightDepthPx = Math.max(0, (slot.depth - slot.width / 2) * pxPerMm);
  const positionPct = slot.position;

  const shared: React.CSSProperties = {
    position: "absolute",
    background: CANVAS_BG,
    pointerEvents: "none",
  };

  switch (edge) {
    case "top":
      return (
        <>
          <div
            style={{
              ...shared,
              left: `${positionPct}%`,
              top: 0,
              width: widthPx,
              height: straightDepthPx,
              transform: "translateX(-50%)",
            }}
          />
          <div
            style={{
              ...shared,
              left: `${positionPct}%`,
              top: -radiusPx,
              width: widthPx,
              height: widthPx,
              borderRadius: "50%",
              transform: "translateX(-50%)",
            }}
          />
        </>
      );
    case "bottom":
      return (
        <>
          <div
            style={{
              ...shared,
              left: `${positionPct}%`,
              bottom: 0,
              width: widthPx,
              height: straightDepthPx,
              transform: "translateX(-50%)",
            }}
          />
          <div
            style={{
              ...shared,
              left: `${positionPct}%`,
              bottom: -radiusPx,
              width: widthPx,
              height: widthPx,
              borderRadius: "50%",
              transform: "translateX(-50%)",
            }}
          />
        </>
      );
    case "left":
      return (
        <>
          <div
            style={{
              ...shared,
              left: 0,
              top: `${positionPct}%`,
              width: straightDepthPx,
              height: widthPx,
              transform: "translateY(-50%)",
            }}
          />
          <div
            style={{
              ...shared,
              left: -radiusPx,
              top: `${positionPct}%`,
              width: widthPx,
              height: widthPx,
              borderRadius: "50%",
              transform: "translateY(-50%)",
            }}
          />
        </>
      );
    case "right":
      return (
        <>
          <div
            style={{
              ...shared,
              right: 0,
              top: `${positionPct}%`,
              width: straightDepthPx,
              height: widthPx,
              transform: "translateY(-50%)",
            }}
          />
          <div
            style={{
              ...shared,
              right: -radiusPx,
              top: `${positionPct}%`,
              width: widthPx,
              height: widthPx,
              borderRadius: "50%",
              transform: "translateY(-50%)",
            }}
          />
        </>
      );
  }
}
