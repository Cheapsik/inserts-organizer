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

export function GamePresetPicker({ iconOnly = false }: { iconOnly?: boolean }) {
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
            {iconOnly ? (
              <button
                type="button"
                aria-label="Wybierz preset gry"
                className="text-[var(--spatial-icon)] transition-colors hover:text-[var(--spatial-accent)]"
              >
                <Gamepad2 size={16} />
              </button>
            ) : (
              <button
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-label="Select game preset"
                className="flex max-w-[180px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition-all hover:bg-white/10 hover:text-white"
              >
                <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-[#ff6b00]" />
                <span className="truncate">{activePreset?.name ?? "Preset"}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="center">
            <Command>
              <CommandInput placeholder="Szukaj gry…" />
              <CommandList>
                <CommandEmpty>Nie znaleziono gier.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="custom manual dimensions" onSelect={handleSelectCustom}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        activePresetId === null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-medium">Własne</span>
                    <span className="ml-2 text-xs text-muted-foreground">Ręczne wymiary</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Popularne gry">
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
            <AlertDialogTitle>Wczytać preset dla {pendingPreset?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Wymiary pudełka zostaną ustawione na{" "}
              {pendingPreset ? formatPresetDimensions(pendingPreset) : ""}. Istniejące moduły
              zostaną zachowane, ale mogą wymagać przesunięcia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelPreset}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyPreset}>Zastosuj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
