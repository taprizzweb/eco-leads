// Guest page themes. Each client picks one in My Page; more can be added here.
// Every theme defines the same CSS variables so components never hard-code colours.

export type ThemeId = "graphite" | "navy" | "midnight" | "pastel" | "sand" | "forest" | "midnightblue" | "gold" | "ocean" | "wine" | "plum" | "ivory";

type Theme = {
  label: string;
  dark: boolean;
  vars: Record<string, string>;
};

export const THEMES: Record<ThemeId, Theme> = {
  // Default: the same graphite as the owner dashboard (Sheen look).
  graphite: {
    label: "Graphite",
    dark: true,
    vars: {
      "--bg": "#0f0f10",
      "--top": "#232325",
      "--surface": "#1a1a1b",
      "--surface-2": "#222224",
      "--text": "#f2f2f2",
      "--muted": "#9b9b9f",
      "--border": "rgba(255,255,255,0.07)",
      "--strip": "#f2f2f2",
      "--strip-text": "#111111",
      "--pill": "#202022",
      "--pill-text": "#d9d9dc",
    },
  },
  navy: {
    label: "Deep Navy",
    dark: true,
    vars: {
      "--bg": "#0A1428",
      "--surface": "#13213D",
      "--surface-2": "#1A2B4D",
      "--text": "#F4F7FC",
      "--muted": "#9DB0D3",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#000000",
      "--strip-text": "#FFFFFF",
      "--pill": "#1E2F52",
      "--pill-text": "#DCE6F8",
    },
  },
  midnight: {
    label: "Midnight",
    dark: true,
    vars: {
      "--bg": "#0B0B0F",
      "--surface": "#17171D",
      "--surface-2": "#202028",
      "--text": "#F5F5F7",
      "--muted": "#A1A1AA",
      "--border": "rgba(255,255,255,0.07)",
      "--strip": "#FFFFFF",
      "--strip-text": "#0B0B0F",
      "--pill": "#24242C",
      "--pill-text": "#E4E4E7",
    },
  },
  pastel: {
    label: "Soft Pastel",
    dark: false,
    vars: {
      "--bg": "#F6F3FF",
      "--surface": "#FFFFFF",
      "--surface-2": "#F1ECFF",
      "--text": "#1D1530",
      "--muted": "#6B6283",
      "--border": "rgba(29,21,48,0.08)",
      "--strip": "#1D1530",
      "--strip-text": "#FFFFFF",
      "--pill": "#E9E2FF",
      "--pill-text": "#3B2D66",
    },
  },
  sand: {
    label: "Warm Sand",
    dark: false,
    vars: {
      "--bg": "#FBF6EE",
      "--surface": "#FFFFFF",
      "--surface-2": "#F5ECDD",
      "--text": "#2B2118",
      "--muted": "#7A6A58",
      "--border": "rgba(43,33,24,0.09)",
      "--strip": "#2B2118",
      "--strip-text": "#FBF6EE",
      "--pill": "#EFE3CF",
      "--pill-text": "#4A3A28",
    },
  },
  forest: {
    label: "Forest",
    dark: true,
    vars: {
      "--bg": "#0C1A14",
      "--surface": "#13271E",
      "--surface-2": "#1A3328",
      "--text": "#EEF6F1",
      "--muted": "#9BBCAB",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#000000",
      "--strip-text": "#FFFFFF",
      "--pill": "#1D3A2D",
      "--pill-text": "#D6EDE0",
    },
  },
  midnightblue: {
    label: "Midnight Blue",
    dark: true,
    vars: {
      "--bg": "#050A1A",
      "--surface": "#0E1630",
      "--surface-2": "#16203F",
      "--text": "#EEF2FF",
      "--muted": "#8F9BC0",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#EEF2FF",
      "--strip-text": "#050A1A",
      "--pill": "#172044",
      "--pill-text": "#D5DEFF",
    },
  },
  gold: {
    label: "Obsidian Gold",
    dark: true,
    vars: {
      "--bg": "#09090A",
      "--surface": "#151413",
      "--surface-2": "#1E1C1A",
      "--text": "#F6F1E7",
      "--muted": "#A39B88",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#D8B25C",
      "--strip-text": "#09090A",
      "--pill": "#24211B",
      "--pill-text": "#EBDDB8",
    },
  },
  ocean: {
    label: "Deep Ocean",
    dark: true,
    vars: {
      "--bg": "#041418",
      "--surface": "#0A2229",
      "--surface-2": "#0F2E37",
      "--text": "#E9FBFA",
      "--muted": "#86B1B2",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#3FD9CC",
      "--strip-text": "#041418",
      "--pill": "#123942",
      "--pill-text": "#CFF5F1",
    },
  },
  wine: {
    label: "Burgundy",
    dark: true,
    vars: {
      "--bg": "#14060B",
      "--surface": "#240D14",
      "--surface-2": "#31121C",
      "--text": "#FDEEF2",
      "--muted": "#B58A96",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#F0678B",
      "--strip-text": "#14060B",
      "--pill": "#3E1824",
      "--pill-text": "#F8D5DE",
    },
  },
  plum: {
    label: "Plum",
    dark: true,
    vars: {
      "--bg": "#0D0716",
      "--surface": "#1A1030",
      "--surface-2": "#241640",
      "--text": "#F4EEFF",
      "--muted": "#A592C8",
      "--border": "rgba(255,255,255,0.08)",
      "--strip": "#A984FF",
      "--strip-text": "#0D0716",
      "--pill": "#2D1D52",
      "--pill-text": "#E3D8FF",
    },
  },
  ivory: {
    label: "Ivory",
    dark: false,
    vars: {
      "--bg": "#F7F3EC",
      "--surface": "#FFFFFF",
      "--surface-2": "#F0EADD",
      "--text": "#1B1710",
      "--muted": "#7B7365",
      "--border": "rgba(27,23,16,0.09)",
      "--strip": "#1B1710",
      "--strip-text": "#F7F3EC",
      "--pill": "#EBE2D0",
      "--pill-text": "#4A3C1F",
    },
  },
};

export function getTheme(id: string | null | undefined): Theme {
  return THEMES[(id as ThemeId) ?? "graphite"] ?? THEMES.graphite;
}

// Each action card keeps its own light tint so the stack is easy to tell apart.
export const CARD_TINTS: Record<string, string> = {
  menu: "168, 85, 247", // purple
  review: "59, 130, 246", // blue
  complaint: "239, 68, 68", // red
  suggestion: "234, 179, 8", // yellow
  offers: "139, 92, 246", // violet
  events: "236, 72, 153", // pink
  membership: "20, 184, 166", // teal
  creators: "249, 115, 22", // orange
  staff: "244, 63, 94", // rose
  wifi: "14, 165, 233", // sky
  instagram: "217, 70, 239", // fuchsia
};
