import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Gamepad2, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GAME_PRESETS, formatPresetDimensions, type GamePreset } from "@/data/gamePresets";
import { useConfigurator } from "@/lib/configurator-store";
import { cn } from "@/lib/utils";

export function GamePresetPicker() {
  const boxWidth = useConfigurator((s) => s.boxWidth);
  const boxHeight = useConfigurator((s) => s.boxHeight);
  const boxDepth = useConfigurator((s) => s.boxDepth);
  const setBoxDimensions = useConfigurator((s) => s.setBoxDimensions);

  const [open, setOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<GamePreset | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activePreset = activePresetId
    ? (GAME_PRESETS.find((preset) => preset.id === activePresetId) ?? null)
    : null;

  useEffect(() => {
    if (!activePresetId || !activePreset) return;
    if (
      boxWidth !== activePreset.boxWidth ||
      boxHeight !== activePreset.boxHeight ||
      boxDepth !== activePreset.boxDepth
    ) {
      setActivePresetId(null);
    }
  }, [boxWidth, boxHeight, boxDepth, activePresetId, activePreset]);

  const handleSelectCustom = () => {
    setActivePresetId(null);
    setOpen(false);
  };

  const handleSelectPreset = (preset: GamePreset) => {
    setOpen(false);
    setPendingPreset(preset);
    setConfirmOpen(true);
  };

  const handleApplyPreset = () => {
    if (!pendingPreset) return;
    setBoxDimensions({
      width: pendingPreset.boxWidth,
      height: pendingPreset.boxHeight,
      depth: pendingPreset.boxDepth,
    });
    setActivePresetId(pendingPreset.id);
    setPendingPreset(null);
    setConfirmOpen(false);
  };

  const handleCancelPreset = () => {
    setPendingPreset(null);
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-label="Select game preset"
              className="flex max-w-[220px] items-center gap-1.5 rounded-full border border-panel-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{activePreset?.name ?? "Select Game"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="center">
            <Command>
              <CommandInput placeholder="Search games…" />
              <CommandList>
                <CommandEmpty>No games found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="custom manual dimensions" onSelect={handleSelectCustom}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activePresetId === null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium">Custom</span>
                    <span className="ml-2 text-xs text-muted-foreground">Manual dimensions</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Popular games">
                  {GAME_PRESETS.map((preset) => (
                    <CommandItem
                      key={preset.id}
                      value={`${preset.name} ${preset.publisher}`}
                      onSelect={() => handleSelectPreset(preset)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          activePresetId === preset.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{preset.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {preset.publisher}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                          {formatPresetDimensions(preset)}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Informacja o wymiarach presetów"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px] text-xs">
              Wymiary bazują na zewnętrznym pudełku wg producentów/insertów. Do projektowania
              insertu zalecamy odjąć 2–3 mm lub zmierzyć pudełko i nadpisać ręcznie.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleCancelPreset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load preset for {pendingPreset?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update box dimensions to{" "}
              {pendingPreset ? formatPresetDimensions(pendingPreset) : ""}. Existing modules will be
              preserved but may need repositioning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPreset}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyPreset}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
