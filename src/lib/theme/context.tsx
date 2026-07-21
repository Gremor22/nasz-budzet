"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PRESET_ID,
  STORAGE_KEY,
  THEME_PRESETS,
  applyThemeVars,
  varsFromAccent,
  type ThemePresetId,
  type ThemeVars,
} from "@/lib/theme/presets";

interface StoredTheme {
  presetId: ThemePresetId;
  customAccent?: string;
}

interface ThemeContextValue {
  presetId: ThemePresetId;
  customAccent: string;
  setPreset: (id: ThemePresetId) => void;
  setCustomAccent: (hex: string) => void;
  presets: typeof THEME_PRESETS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadStored(): StoredTheme {
  if (typeof window === "undefined") {
    return { presetId: DEFAULT_PRESET_ID };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { presetId: DEFAULT_PRESET_ID };
    return JSON.parse(raw) as StoredTheme;
  } catch {
    return { presetId: DEFAULT_PRESET_ID };
  }
}

function resolveVars(stored: StoredTheme): ThemeVars {
  if (stored.presetId === "custom" && stored.customAccent) {
    return varsFromAccent(stored.customAccent);
  }
  const preset =
    THEME_PRESETS.find((p) => p.id === stored.presetId) ?? THEME_PRESETS[0]!;
  return preset.vars;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredTheme>(() => loadStored());

  useEffect(() => {
    applyThemeVars(resolveVars(stored));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [stored]);

  const setPreset = useCallback((id: ThemePresetId) => {
    setStored((prev) => ({ ...prev, presetId: id }));
  }, []);

  const setCustomAccent = useCallback((hex: string) => {
    setStored({ presetId: "custom", customAccent: hex });
  }, []);

  const value = useMemo(
    () => ({
      presetId: stored.presetId,
      customAccent: stored.customAccent ?? "#2d6a4f",
      setPreset,
      setCustomAccent,
      presets: THEME_PRESETS,
    }),
    [stored, setPreset, setCustomAccent],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme wymaga ThemeProvider");
  return ctx;
}
