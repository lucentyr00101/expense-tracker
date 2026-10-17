"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { ChartColumn, Table2 } from "lucide-react";
import type { CategoryTotal, SeriesPoint } from "@/lib/data";
import { bucketLabel, bucketTitle, type Granularity } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/**
 * Two stacked bars per bucket, expenses then income, each split by category.
 * Only categories with transactions in the range get a series, and a bucket
 * with no income (or no expenses) draws nothing on that side.
 */
export function CashFlowChart({ data, expense, income, group, currency }: {
  data: SeriesPoint[];
  expense: CategoryTotal[];
  income: CategoryTotal[];
  group: Granularity;
  currency: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Render order is stack order: expenses form the left bar, and the largest category sits at the bottom.
  const all = [...expense, ...income];
  const incomeIds = new Set(income.map((c) => c.id));
  const visible = all.filter((c) => !hidden.has(c.id));

  const rows = data.map((d) => {
    const row: Record<string, string | number> = { bucket: d.bucket, label: bucketLabel(d.bucket, group) };
    for (const [id, amount] of Object.entries(d.byCategory)) row[id] = amount;
    return row;
  });

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < all.length - 1) next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {[
            { label: "Expenses", list: expense },
            { label: "Income", list: income },
          ]
            .filter((g) => g.list.length)
            .map((g) => (
              <ul key={g.label} className="flex flex-wrap items-center gap-x-1" aria-label={`${g.label} categories`}>
                <li className="w-18 shrink-0 text-xs font-medium text-subtle">{g.label}</li>
                {g.list.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={!hidden.has(c.id)}
                      onClick={() => toggle(c.id)}
                      className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm transition-opacity duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ring ${
                        hidden.has(c.id) ? "opacity-45" : ""
                      }`}
                    >
                      <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost h-9 shrink-0 px-3"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
        >
          {view === "chart" ? <Table2 className="size-4" aria-hidden /> : <ChartColumn className="size-4" aria-hidden />}
          {view === "chart" ? "Table" : "Chart"}
        </button>
      </div>

      {view === "chart" ? (
        <div
          className="h-72 w-full"
          role="img"
          aria-label={`Expenses and income by category per ${group}. Switch to the table view for exact values.`}
        >
          <ResponsiveContainer>
            <BarChart
              data={rows}
              barGap={2}
              barCategoryGap={rows.length > 40 ? "10%" : "25%"}
              margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
            >
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
                content={(props) => <ChartTooltip {...props} incomeIds={incomeIds} group={group} currency={currency} />}
              />
              {visible.map((c) => (
                <Bar
                  key={c.id}
                  dataKey={c.id}
                  name={c.name}
                  stackId={incomeIds.has(c.id) ? "income" : "expense"}
                  fill={c.color}
                  maxBarSize={36}
                />
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

/** Lists only the categories present in the hovered bucket, grouped into expenses and income. */
function ChartTooltip({ active, payload, incomeIds, group, currency }: TooltipContentProps & {
  incomeIds: Set<string>;
  group: Granularity;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const bucket = String((payload[0].payload as { bucket: string }).bucket);
  const entries = payload.filter((p) => Number(p.value));
  const sections = [
    { label: "Expenses", items: entries.filter((p) => !incomeIds.has(String(p.dataKey))) },
    { label: "Income", items: entries.filter((p) => incomeIds.has(String(p.dataKey))) },
  ].filter((s) => s.items.length);

  return (
    <div className="min-w-48 rounded-lg border border-line bg-surface-strong px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-medium">{bucketTitle(bucket, group)}</p>
      {sections.length === 0 && <p className="text-muted">No transactions</p>}
      {sections.map((s) => {
        const total = s.items.reduce((sum, p) => sum + Number(p.value), 0);
        return (
          <div key={s.label} className="mt-1.5 first-of-type:mt-0">
            <p className="flex text-xs font-medium text-subtle">
              {s.label}
              <span className="tabular ml-auto pl-4">{formatMoney(total, currency)}</span>
            </p>
            {[...s.items]
              .sort((a, b) => Number(b.value) - Number(a.value))
              .map((p) => (
                <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted">
                  <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                  {p.name}
                  <span className="tabular ml-auto pl-4 font-medium text-fg">
                    {formatMoney(Number(p.value), currency)}
                  </span>
                </p>
              ))}
          </div>
        );
      })}
    </div>
  );
}
