"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategorySlice } from "@/lib/analytics/summary";
import { CATEGORY_CHART_COLORS } from "@/lib/categories";
import { formatPlnShort } from "@/lib/money/format";

type ChartMode = "pie" | "bar";

const CHART_STORAGE = "nasz-budzet-chart-mode";

function CategoryLegend({ slices }: { slices: CategorySlice[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {slices.slice(0, 5).map((c, i) => (
        <li
          key={c.category}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                background:
                  CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
              }}
            />
            <span className="truncate">{c.category}</span>
          </span>
          <span className="shrink-0 text-right tabular-nums text-[var(--ink-muted)]">
            {formatPlnShort(c.amountGrosze)} · {c.percent}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CategorySpendingChart({
  slices,
}: {
  slices: CategorySlice[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [mode, setMode] = useState<ChartMode>("pie");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHART_STORAGE);
      if (stored === "pie" || stored === "bar") setMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(el.clientWidth, 240));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function switchMode(next: ChartMode) {
    setMode(next);
    try {
      localStorage.setItem(CHART_STORAGE, next);
    } catch {
      /* ignore */
    }
  }

  if (slices.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
        Brak wydatków w tym miesiącu.
      </p>
    );
  }

  const data = slices.map((c) => ({
    name: c.category,
    value: c.amountGrosze / 100,
    grosze: c.amountGrosze,
    percent: c.percent,
  }));

  const height = 180;

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("pie")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === "pie"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)] text-[var(--ink)]"
          }`}
        >
          Koło
        </button>
        <button
          type="button"
          onClick={() => switchMode("bar")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            mode === "bar"
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--bg-accent)] text-[var(--ink)]"
          }`}
        >
          Słupki
        </button>
      </div>

      <div ref={containerRef} className="w-full min-w-0">
        {mode === "pie" ? (
          <PieChart width={width} height={height}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx={width / 2}
              cy={height / 2}
              innerRadius={42}
              outerRadius={Math.min(72, width / 2 - 16)}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const p = item?.payload as { percent: number; name: string };
                const n = Number(value);
                return [
                  `${n.toFixed(2)} zł (${p?.percent ?? 0}%)`,
                  p?.name ?? "",
                ];
              }}
            />
          </PieChart>
        ) : (
          <BarChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--ink-muted)" }}
              interval={0}
              angle={-28}
              textAnchor="end"
              height={56}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value, _name, item) => {
                const p = item?.payload as { percent: number };
                return [`${Number(value).toFixed(2)} zł (${p?.percent ?? 0}%)`, "Kwota"];
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </div>

      <CategoryLegend slices={slices} />
    </div>
  );
}
