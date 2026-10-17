"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { ChartColumn, Table2 } from "lucide-react";
import type { SeriesPoint } from "@/lib/data";
import { bucketLabel, bucketTitle, type Granularity } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const SERIES = [
  { key: "expense", label: "Expenses", color: "var(--series-expense)" },
  { key: "income", label: "Income", color: "var(--series-income)" },
] as const;

export function CashFlowChart({ data, group, currency }: { data: SeriesPoint[]; group: Granularity; currency: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const rows = data.map((d) => ({ ...d, label: bucketLabel(d.bucket, group) }));

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < SERIES.length - 1) next.add(key);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex gap-1" aria-label="Series">
          {SERIES.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={!hidden.has(s.key)}
                onClick={() => toggle(s.key)}
                className={`flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-opacity duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ring ${
                  hidden.has(s.key) ? "opacity-45" : ""
                }`}
              >
                <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-ghost h-9 px-3"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
        >
          {view === "chart" ? <Table2 className="size-4" aria-hidden /> : <ChartColumn className="size-4" aria-hidden />}
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {view === "chart" ? (
        <div className="h-72 w-full" role="img" aria-label={`Expenses and income per ${group}. Switch to the table view for exact values.`}>
          <ResponsiveContainer>
            <BarChart data={rows} barGap={2} barCategoryGap={rows.length > 40 ? "10%" : "25%"} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                content={(props) => <ChartTooltip {...props} group={group} currency={currency} />}
              />
              {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Expenses and income per {group}</caption>
            <thead className="sticky top-0 bg-surface-strong text-left text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Period</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Expenses</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Income</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {data.map((d) => (
                <tr key={d.bucket}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">{bucketTitle(d.bucket, group)}</th>
                  <td className="px-3 py-2 text-right">{formatMoney(d.expense, currency)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(d.income, currency)}</td>
                  <td className={`px-3 py-2 text-right ${d.income - d.expense < 0 ? "text-danger" : ""}`}>
                    {formatMoney(d.income - d.expense, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, group, currency }: TooltipContentProps & { group: Granularity; currency: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as SeriesPoint;
  return (
    <div className="rounded-lg border border-line bg-surface-strong px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium">{bucketTitle(point.bucket, group)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          {p.name}
          <span className="tabular ml-auto pl-4 font-medium text-fg">{formatMoney(Number(p.value), currency)}</span>
        </p>
      ))}
    </div>
  );
}
