"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CategorySlice } from "@/lib/analytics/summary";
import { formatPlnShort } from "@/lib/money/format";

const COLORS = [
  "#2d6a4f",
  "#40916c",
  "#52b788",
  "#74c69d",
  "#95d5b2",
  "#1b4332",
  "#52796f",
  "#84a98c",
];

export function MonthCategoryChart({
  slices,
}: {
  slices: CategorySlice[];
}) {
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
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={72}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
      <ul className="mt-2 space-y-1">
        {slices.slice(0, 5).map((c, i) => (
          <li
            key={c.category}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {c.category}
            </span>
            <span className="text-[var(--ink-muted)]">
              {formatPlnShort(c.amountGrosze)} · {c.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
