"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CategorySlice } from "@/lib/analytics/summary";
import { CATEGORY_CHART_COLORS } from "@/lib/categories";
import { formatPlnShort } from "@/lib/money/format";

export function MonthCategoryChart({
  slices,
}: {
  slices: CategorySlice[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="w-full min-w-0">
      <div className="relative h-[168px] w-full min-w-0">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={68}
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
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-[var(--bg-accent)]" />
        )}
      </div>
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
    </div>
  );
}
