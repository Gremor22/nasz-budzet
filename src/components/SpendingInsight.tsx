"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildLocalSpendingInsight,
  toInsightInput,
  type SpendingInsightInput,
} from "@/lib/analytics/insight";
import type { AnalyticsSummary } from "@/lib/analytics/summary";
import { Card, Label } from "@/components/ui";

export function SpendingInsight({
  summary,
  monthLabel,
  monthKey,
  enabled,
}: {
  summary: AnalyticsSummary;
  monthLabel: string;
  monthKey: string;
  enabled: boolean;
}) {
  const input = useMemo(
    () => toInsightInput(summary, monthLabel),
    [summary, monthLabel],
  );
  const localInsight = buildLocalSpendingInsight(input);

  const [insight, setInsight] = useState(localInsight);
  const [source, setSource] = useState<"gemini" | "local">("local");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInsight(buildLocalSpendingInsight(input));
    setSource("local");

    if (!enabled || input.expenseTotalGrosze <= 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/analytics/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input satisfies SpendingInsightInput),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          insight?: string;
          source?: "gemini" | "local";
        };
        if (cancelled || !data.insight) return;
        setInsight(data.insight);
        setSource(data.source ?? "local");
      } catch {
        /* zostaje lokalne */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monthKey, enabled, input]);

  if (input.expenseTotalGrosze <= 0) return null;

  return (
    <Card data-tour="spending-insight">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label>Podsumowanie wydatków</Label>
        <span className="text-xs text-[var(--ink-muted)]">
          {loading ? "AI…" : source === "gemini" ? "AI" : "auto"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--ink)]">{insight}</p>
    </Card>
  );
}
