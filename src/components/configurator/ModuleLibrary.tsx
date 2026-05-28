import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BUILTIN_MODULES, formatMm, type InsertModule, type ModuleType } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-store";
import { Boxes, Layers, Sparkles, Swords } from "lucide-react";
import { CustomModuleDialog, EditCustomModuleButton } from "./CustomModuleDialog";

const TYPE_META: Record<ModuleType, { label: string; icon: typeof Layers }> = {
  cards: { label: "Cards", icon: Layers },
  tokens: { label: "Tokens & Bits", icon: Boxes },
  minis: { label: "Miniatures", icon: Swords },
  custom: { label: "Custom", icon: Sparkles },
};

function LibraryItem({ module: m }: { module: InsertModule }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${m.id}`,
    data: { source: "library", moduleId: m.id },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative flex cursor-grab touch-none items-center gap-3 rounded-xl border border-panel-border bg-card/60 p-3 transition-colors hover:border-primary/40 hover:bg-card active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 font-mono text-[10px] font-medium text-foreground/80"
        style={{
          background: `linear-gradient(135deg, ${m.color}40, ${m.color}15)`,
          boxShadow: `inset 0 0 0 1px ${m.color}55`,
        }}
      >
        {formatMm(m.width)}×{formatMm(m.height)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
          <span
            className="shrink-0 rounded-sm border border-white/10 bg-card/80 px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
            title="Z-axis depth"
          >
            {formatMm(m.depth)}mm
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">
            {formatMm(m.width)}×{formatMm(m.height)}mm
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span className="font-mono text-primary">{m.price} PLN</span>
        </div>
      </div>

      {m.type === "custom" && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <EditCustomModuleButton moduleId={m.id} />
        </div>
      )}
    </motion.div>
  );
}

export function ModuleLibrary() {
  const customModules = useConfigurator((s) => s.customModules);
  const modules = useMemo<InsertModule[]>(
    () => [...BUILTIN_MODULES, ...customModules],
    [customModules],
  );

  const grouped = (Object.keys(TYPE_META) as ModuleType[]).map((type) => ({
    type,
    meta: TYPE_META[type],
    items: modules.filter((m) => m.type === type),
  }));

  return (
    <aside className="glass-panel flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-2xl">
      <div className="border-b border-panel-border px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Module Library
        </div>
        <h2 className="mt-1 text-lg font-semibold text-foreground">3D-Printed Inserts</h2>
      </div>

      <div className="border-b border-panel-border p-4">
        <CustomModuleDialog />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {grouped.map(({ type, meta, items }) => {
          if (!items.length) return null;
          const Icon = meta.icon;
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((m) => (
                  <LibraryItem key={m.id} module={m} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-panel-border px-5 py-3 text-[11px] text-muted-foreground">
        Drag any module onto the canvas →
      </div>
    </aside>
  );
}
