"use client";

import { Label } from "@/components/ui";
import { useTheme } from "@/lib/theme/context";
import type { ThemePresetId } from "@/lib/theme/presets";

export function ThemeSettings() {
  const { presetId, customAccent, setPreset, setCustomAccent, presets } =
    useTheme();

  return (
    <div className="flex flex-col gap-3">
      <Label>Wygląd aplikacji</Label>
      <p className="text-sm text-[var(--ink-muted)]">
        Presety kolorów — zapisują się na tym urządzeniu.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setPreset(preset.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
              presetId === preset.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium"
                : "border-[var(--line)] bg-white"
            }`}
          >
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-black/10"
              style={{ background: preset.vars.accent }}
            />
            {preset.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset("custom" as ThemePresetId)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm ${
            presetId === "custom"
              ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium"
              : "border-[var(--line)] bg-white"
          }`}
        >
          <span
            className="h-6 w-6 shrink-0 rounded-full border border-black/10"
            style={{
              background: `conic-gradient(${customAccent}, ${customAccent}88, ${customAccent})`,
            }}
          />
          Własny
        </button>
      </div>
      {presetId === "custom" && (
        <div>
          <Label>Kolor główny</Label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="color"
              value={customAccent}
              onChange={(e) => setCustomAccent(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
            />
            <input
              type="text"
              value={customAccent}
              onChange={(e) => setCustomAccent(e.target.value)}
              className="flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm uppercase"
              maxLength={7}
            />
          </div>
        </div>
      )}
    </div>
  );
}
