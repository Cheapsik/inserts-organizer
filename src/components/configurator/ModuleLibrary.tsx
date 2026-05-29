import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useMemo } from "react";
import { BUILTIN_MODULES, type InsertModule } from "@/lib/insert-types";
import { useConfigurator } from "@/lib/configurator-store";
import { CustomModuleDialog, EditCustomModuleButton } from "./CustomModuleDialog";
import { LayersPanel } from "./LayersPanel";

function LibraryItem({ module: m }: { module: InsertModule }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${m.id}`,
    data: { source: "library", moduleId: m.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group flex cursor-grab touch-none items-center gap-3 rounded-xl border border-transparent bg-[var(--spatial-surface)] p-2.5 transition-all duration-200 hover:translate-x-1 hover:border-[var(--spatial-surface-border)] hover:bg-[var(--spatial-surface-hover)] active:cursor-grabbing active:shadow-[0_24px_48px_var(--spatial-shadow-heavy)] ${
        isDragging ? "opacity-30 shadow-[0_24px_48px_var(--spatial-shadow-heavy)]" : ""
      }`}
    >
      <div
        className="h-8 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: m.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--spatial-module-text)]">
          {m.name}
        </p>
        <p className="font-mono text-[11px] text-[var(--spatial-text-subtle)]">
          {m.width}×{m.height}×{m.depth}mm
        </p>
      </div>
      {m.type === "custom" && <EditCustomModuleButton moduleId={m.id} />}
      <GripVertical
        size={14}
        className="text-transparent transition-colors group-hover:text-[var(--spatial-text-faint)]"
      />
    </div>
  );
}

export function ModuleLibrary() {
  const customModules = useConfigurator((s) => s.customModules);
  const modules = useMemo<InsertModule[]>(
    () => [...BUILTIN_MODULES, ...customModules],
    [customModules],
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--spatial-accent)]">
          Moduły
        </h3>
        <span className="text-[10px] text-[var(--spatial-text-subtle)]">{modules.length} szt.</span>
      </div>

      <div className="widget-scrollbar flex max-h-[32vh] flex-col gap-2 overflow-y-auto pr-1">
        {modules.map((m) => (
          <LibraryItem key={m.id} module={m} />
        ))}
      </div>

      <CustomModuleDialog />

      <div className="h-[1px] w-full bg-[var(--spatial-surface-border)]" />

      <LayersPanel />
    </>
  );
}
