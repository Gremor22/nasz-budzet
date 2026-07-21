export type ThemePresetId =
  | "forest"
  | "ocean"
  | "sunset"
  | "grape"
  | "slate"
  | "custom";

export interface ThemeVars {
  bg: string;
  bgAccent: string;
  ink: string;
  inkMuted: string;
  card: string;
  line: string;
  safe: string;
  warn: string;
  danger: string;
  accent: string;
  accentSoft: string;
  chartBg1: string;
  chartBg2: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  vars: ThemeVars;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "forest",
    name: "Las",
    vars: {
      bg: "#f3f0eb",
      bgAccent: "#e7efe8",
      ink: "#1c2a22",
      inkMuted: "#5a6b61",
      card: "#fffcf7",
      line: "#d5ddd6",
      safe: "#1f6b4a",
      warn: "#9a5b14",
      danger: "#9b2c2c",
      accent: "#2d6a4f",
      accentSoft: "#d8f3dc",
      chartBg1: "#d8f3dc",
      chartBg2: "#e8e4d9",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    vars: {
      bg: "#eef4f8",
      bgAccent: "#dceaf3",
      ink: "#1a2a36",
      inkMuted: "#5a6d7a",
      card: "#fafcfe",
      line: "#c8d8e4",
      safe: "#156b5a",
      warn: "#b45309",
      danger: "#b91c1c",
      accent: "#1d6a8a",
      accentSoft: "#cce8f4",
      chartBg1: "#cce8f4",
      chartBg2: "#e2e8f0",
    },
  },
  {
    id: "sunset",
    name: "Zachód",
    vars: {
      bg: "#faf5f0",
      bgAccent: "#f5e8dc",
      ink: "#3d2914",
      inkMuted: "#7a6555",
      card: "#fffcfa",
      line: "#e8d5c4",
      safe: "#2d6a4f",
      warn: "#c2410c",
      danger: "#991b1b",
      accent: "#c05621",
      accentSoft: "#fde8d8",
      chartBg1: "#fde8d8",
      chartBg2: "#f5e6d3",
    },
  },
  {
    id: "grape",
    name: "Winogrono",
    vars: {
      bg: "#f5f0f8",
      bgAccent: "#ebe0f2",
      ink: "#2a1a33",
      inkMuted: "#6b5a75",
      card: "#fdfbff",
      line: "#ddd0e8",
      safe: "#2d6a4f",
      warn: "#a16207",
      danger: "#9f1239",
      accent: "#6b21a8",
      accentSoft: "#ede0f7",
      chartBg1: "#ede0f7",
      chartBg2: "#e8e0ef",
    },
  },
  {
    id: "slate",
    name: "Grafit",
    vars: {
      bg: "#f1f3f5",
      bgAccent: "#e2e6ea",
      ink: "#1e293b",
      inkMuted: "#64748b",
      card: "#ffffff",
      line: "#cbd5e1",
      safe: "#0f766e",
      warn: "#b45309",
      danger: "#dc2626",
      accent: "#334155",
      accentSoft: "#e2e8f0",
      chartBg1: "#e2e8f0",
      chartBg2: "#f1f5f9",
    },
  },
];

export const DEFAULT_PRESET_ID: ThemePresetId = "forest";

export const STORAGE_KEY = "nasz-budzet-theme-v1";

export function applyThemeVars(vars: ThemeVars): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--bg", vars.bg);
  root.style.setProperty("--bg-accent", vars.bgAccent);
  root.style.setProperty("--ink", vars.ink);
  root.style.setProperty("--ink-muted", vars.inkMuted);
  root.style.setProperty("--card", vars.card);
  root.style.setProperty("--line", vars.line);
  root.style.setProperty("--safe", vars.safe);
  root.style.setProperty("--warn", vars.warn);
  root.style.setProperty("--danger", vars.danger);
  root.style.setProperty("--accent", vars.accent);
  root.style.setProperty("--accent-soft", vars.accentSoft);
  root.style.setProperty("--chart-bg-1", vars.chartBg1);
  root.style.setProperty("--chart-bg-2", vars.chartBg2);
}

export function varsFromAccent(accent: string): ThemeVars {
  return {
    ...THEME_PRESETS[0]!.vars,
    accent,
    accentSoft: `${accent}22`,
    safe: accent,
  };
}
