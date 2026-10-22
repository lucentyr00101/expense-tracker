"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChartColumn } from "lucide-react";
import type { CategoryTotal } from "@/lib/data";
import type { TxType } from "@/lib/category-defs";
import { formatMoney } from "@/lib/money";
import { CategoryIcon } from "./category-icon";
import { EmptyState } from "./ui";

// Rows shown before "Show all"; a long tail of small categories would otherwise dwarf the chart beside it.
const TOP = 6;

/** Ranked horizontal bars; click a category to see its subcategories. */
export function CategoryBreakdown({ expense, income, currency }: {
  expense: CategoryTotal[];
  income: CategoryTotal[];
  currency: string;
}) {
  const [type, setType] = useState<TxType>("expense");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const list = type === "expense" ? expense : income;
  const open = list.find((c) => c.id === openId) ?? null;
  const total = list.reduce((s, c) => s + c.amount, 0);
  const bar = type === "expense" ? "var(--series-expense)" : "var(--series-income)";

  type Row = { key: string; name: string; amount: number; cat?: CategoryTotal };
  const rows: Row[] = open
    ? open.children.map((c, i) => ({ key: c.id ?? `general-${i}`, name: c.name, amount: c.amount }))
    : list.map((c) => ({ key: c.id, name: c.name, amount: c.amount, cat: c }));
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const base = open ? open.amount : total;
  // Collapsing a single extra row saves nothing, so only cut when at least two would be hidden.
  const collapsible = rows.length > TOP + 1;
  const shown = collapsible && !showAll ? rows.slice(0, TOP) : rows;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        {open ? (
          <button type="button" className="btn btn-ghost h-11 px-3 sm:h-9" onClick={() => setOpenId(null)}>
            <ChevronLeft className="size-4" aria-hidden />
            All categories
          </button>
        ) : (
          <div role="group" aria-label="Type" className="flex gap-1 rounded-lg bg-sunken p-1">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`h-9 cursor-pointer rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                  type === t ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
                }`}
              >
                {t === "expense" ? "Expenses" : "Income"}
              </button>
            ))}
          </div>
        )}
        <p className="tabular text-sm text-muted">{formatMoney(open ? open.amount : total, currency)}</p>
      </div>

      {open && <h3 className="mb-2 font-medium">{open.name}</h3>}

      {rows.length === 0 ? (
        <EmptyState icon={<ChartColumn className="size-8" aria-hidden />} title={`No ${type} in this range`} />
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {shown.map((r) => {
              const pct = base ? Math.round((r.amount / base) * 100) : 0;
              const content = (
                <>
                  {r.cat && <CategoryIcon icon={r.cat.icon} color={r.cat.color} size="sm" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="tabular shrink-0">{formatMoney(r.amount, currency)}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span aria-hidden className="block h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                        <span className="block h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, backgroundColor: bar }} />
                      </span>
                      <span className="tabular w-9 shrink-0 text-right text-xs text-subtle">{pct}%</span>
                    </span>
                  </span>
                </>
              );
              return (
                <li key={r.key}>
                  {r.cat ? (
                    <button
                      type="button"
                      onClick={() => setOpenId(r.key)}
                      aria-label={`${r.name}: ${formatMoney(r.amount, currency)}, ${pct}%. Show subcategories`}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left min-[360px]:gap-3 transition-colors duration-150 hover:bg-sunken active:bg-sunken focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {content}
                      <ChevronRight className="size-4 shrink-0 text-subtle max-[359px]:hidden" aria-hidden />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 p-2 min-[360px]:gap-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {collapsible && (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
              className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted transition-colors duration-150 hover:bg-sunken hover:text-fg active:bg-sunken focus-visible:outline-2 focus-visible:outline-ring"
            >
              {showAll ? `Show top ${TOP}` : `Show all ${rows.length}`}
              <ChevronDown className={`size-4 transition-transform duration-200 ${showAll ? "rotate-180" : ""}`} aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}
