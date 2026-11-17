// Guest page themes. Each client picks one in My Page; more can be added here.
// Every theme defines the same CSS variables so components never hard-code colours.

export type ThemeId = "navy" | "midnight" | "pastel" | "sand" | "forest";

type Theme = {
  label: string;
  dark: boolean;
  vars: Record<string, string>;
};

export const THEMES: Record<ThemeId, Theme> = {
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
};

export function getTheme(id: string | null | undefined): Theme {
  return THEMES[(id as ThemeId) ?? "navy"] ?? THEMES.navy;
}

// Each action card keeps its own light tint so the stack is easy to tell apart.
export const CARD_TINTS: Record<string, string> = {
  menu: "168, 85, 247", // purple
  review: "59, 130, 246", // blue
  complaint: "239, 68, 68", // red
  suggestion: "234, 179, 8", // yellow
  moment: "34, 197, 94", // green
  offers: "139, 92, 246", // violet
  events: "236, 72, 153", // pink
  membership: "20, 184, 166", // teal
  creators: "249, 115, 22", // orange
};
