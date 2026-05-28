import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BUILTIN_MODULES, formatMm, type InsertModule } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-store";
import { CustomModuleDialog, EditCustomModuleButton } from "./CustomModuleDialog";
import { LayersPanel } from "./LayersPanel";

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
      whileTap={{ scale: 0.99 }}
      className={`group relative flex cursor-grab touch-none items-center gap-2 rounded-lg border border-panel-border bg-card/50 px-2 py-1.5 transition-colors hover:border-primary/35 hover:bg-card active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        className="h-7 w-7 shrink-0 rounded border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${m.color}55, ${m.color}20)`,
          boxShadow: `inset 0 0 0 1px ${m.color}50`,
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground">{m.name}</div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {formatMm(m.width)}×{formatMm(m.height)}×{formatMm(m.depth)} mm
        </div>
      </div>
      {m.type === "custom" && (
        <EditCustomModuleButton moduleId={m.id} />
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

  return (
    <aside className="glass-panel flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-panel-border px-3 py-2.5">
        <span className="text-xs font-semibold text-foreground">Modules</span>
        <CustomModuleDialog compact />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
        <div className="space-y-1">
          {modules.map((m) => (
            <LibraryItem key={m.id} module={m} />
          ))}
        </div>
      </div>

      <LayersPanel />
    </aside>
  );
}
