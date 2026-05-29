export interface GamePreset {
  id: string;
  name: string;
  publisher: string;
  boxWidth: number;
  boxHeight: number;
  boxDepth: number;
  bggId?: number;
}

export const GAME_PRESETS: GamePreset[] = [
  // Awaken Realms – Nemesis (base)
  {
    id: "nemesis",
    name: "Nemesis",
    publisher: "Awaken Realms",
    boxWidth: 297, // 29.7 cm
    boxHeight: 297, // 29.7 cm
    boxDepth: 145, // 14.5 cm
    bggId: 167355,
  },

  // Awaken Realms – Nemesis: Lockdown (różne inserty podają 15.2–16.5 cm wysokości)
  {
    id: "nemesis-lockdown",
    name: "Nemesis: Lockdown",
    publisher: "Awaken Realms",
    boxWidth: 300, // 30.0 cm
    boxHeight: 300, // 30.0 cm
    boxDepth: 152, // 15.2 cm – konserwatywnie niższa wartość, żeby insert się zmieścił
  },

  // FryxGames – Terraforming Mars
  {
    id: "terraforming-mars",
    name: "Terraforming Mars",
    publisher: "FryxGames",
    boxWidth: 295, // 29.5 cm
    boxHeight: 295, // 29.5 cm
    boxDepth: 71, // 7.1 cm
  },

  // Cephalofair – Gloomhaven (1st edition)
  {
    id: "gloomhaven-1e",
    name: "Gloomhaven (1st Edition)",
    publisher: "Cephalofair Games",
    boxWidth: 406, // 40.6 cm
    boxHeight: 292, // 29.2 cm
    boxDepth: 191, // 19.1 cm
  },

  // Cephalofair – Gloomhaven (2nd edition, wyższe pudełko)
  {
    id: "gloomhaven-2e",
    name: "Gloomhaven (2nd Edition)",
    publisher: "Cephalofair Games",
    boxWidth: 413, // 41.3 cm
    boxHeight: 298, // 29.8 cm
    boxDepth: 233, // 23.3 cm
  },

  // Fantasy Flight – Twilight Imperium 4th Edition
  {
    id: "twilight-imperium-4",
    name: "Twilight Imperium 4th Edition",
    publisher: "Fantasy Flight Games",
    boxWidth: 433, // 43.3 cm
    boxHeight: 300, // 30.0 cm
    boxDepth: 134, // 13.4 cm
  },

  // Z-Man – Pandemic
  {
    id: "pandemic",
    name: "Pandemic",
    publisher: "Z-Man Games",
    boxWidth: 306, // 30.6 cm
    boxHeight: 224, // 22.4 cm
    boxDepth: 44, // 4.4 cm
  },

  // Fantasy Flight – Arkham Horror LCG (Revised Core box 25.4 x 29.2 x 7.6)
  {
    id: "arkham-horror-lcg-revised",
    name: "Arkham Horror: The Card Game (Revised Core)",
    publisher: "Fantasy Flight Games",
    boxWidth: 254, // 25.4 cm
    boxHeight: 292, // 29.2 cm
    boxDepth: 76, // 7.6 cm
  },

  // Greater Than Games – Spirit Island
  {
    id: "spirit-island",
    name: "Spirit Island",
    publisher: "Greater Than Games",
    boxWidth: 295, // 29.5 cm
    boxHeight: 295, // 29.5 cm
    boxDepth: 78, // 7.8 cm
  },

  // Roxley – Brass: Birmingham (i Lancashire – ten sam format pudełka)
  {
    id: "brass-birmingham",
    name: "Brass: Birmingham",
    publisher: "Roxley Games",
    boxWidth: 290, // 29.0 cm
    boxHeight: 290, // 29.0 cm
    boxDepth: 49, // 4.9 cm
  },

  // Stonemaier – Scythe (base box, nie Legendary Box)
  {
    id: "scythe",
    name: "Scythe",
    publisher: "Stonemaier Games",
    boxWidth: 300, // 30.0 cm
    boxHeight: 365, // 36.5 cm
    boxDepth: 98, // 9.8 cm
  },

  // Catan Studio – Catan (base game)
  {
    id: "catan",
    name: "Catan (Base Game)",
    publisher: "Catan Studio",
    boxWidth: 290, // 29.0 cm
    boxHeight: 235, // 23.5 cm
    boxDepth: 75, // 7.5 cm
  },

  // Stonemaier – Wingspan
  {
    id: "wingspan",
    name: "Wingspan",
    publisher: "Stonemaier Games",
    boxWidth: 300, // 30.0 cm
    boxHeight: 300, // 30.0 cm
    boxDepth: 70, // ~7.0 cm
  },

  // Portal Games – Robinson Crusoe (standard box, może się różnić między edycjami)
  {
    id: "robinson-crusoe",
    name: "Robinson Crusoe",
    publisher: "Portal Games",
    boxWidth: 285, // 28.5 cm
    boxHeight: 285, // 28.5 cm
    boxDepth: 56, // 5.6 cm
  },

  // Stonemaier – Viticulture Essential Edition
  {
    id: "viticulture-ee",
    name: "Viticulture Essential Edition",
    publisher: "Stonemaier Games",
    boxWidth: 270, // 27.0 cm
    boxHeight: 220, // 22.0 cm
    boxDepth: 100, // 10.0 cm (dolna wartość z zakresu 10.0–10.5 cm)
  },

  // The Witcher: Old World – Core Box (Go On Board)
  {
    id: "witcher-old-world",
    name: "The Witcher: Old World",
    publisher: "Go On Board",
    boxWidth: 291, // 29.1 cm
    boxHeight: 291, // 29.1 cm
    boxDepth: 74, // 7.4 cm
  },
];

export function formatPresetDimensions(preset: GamePreset): string {
  return `${preset.boxWidth}×${preset.boxHeight}×${preset.boxDepth}mm`;
}
