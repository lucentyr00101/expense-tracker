import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getToday, getLedger } from "@/lib/session";
import { getBudgetStatus, getSettings } from "@/lib/data";
import { addMonths, endOf, formatDate, isIsoDate, startOf } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BudgetForm } from "@/components/budget-row";
import { BudgetMeter } from "@/components/budget-meter";
import { CategoryIcon } from "@/components/category-icon";
import { Card, PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <>
      <PageHeader title="Budgets" description="Monthly spending limits per category. They repeat every month." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Budgets searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Budgets({ searchParams }: { searchParams: PageProps<"/budgets">["searchParams"] }) {
  const [ledger, today, params] = await Promise.all([getLedger(), getToday(), searchParams]);
  const requested = `${params.month}-01`;
  const thisMonth = startOf(today, "month");
  const month = isIsoDate(requested) && requested <= thisMonth ? requested : thisMonth;

  const [rows, { currency }] = await Promise.all([
    getBudgetStatus(ledger.ledgerId, month, endOf(month, "month")),
    getSettings(ledger.ledgerId),
  ]);
  const canEdit = ledger.role !== "viewer";
  const withBudget = rows.filter((r) => r.budget !== null);
  const totalBudget = withBudget.reduce((s, r) => s + r.budget!, 0);
  const totalSpent = withBudget.reduce((s, r) => s + r.spent, 0);
  const prev = addMonths(month, -1).slice(0, 7);
  const next = addMonths(month, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href={`/budgets?month=${prev}`} className="icon-btn shrink-0 border border-line-strong" aria-label="Previous month">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <p className="flex-1 text-center font-semibold sm:min-w-36 sm:flex-none">{formatDate(month, { month: "long", year: "numeric" })}</p>
        <Link
          href={`/budgets?month=${next.slice(0, 7)}`}
          aria-label="Next month"
          aria-disabled={next > thisMonth}
          tabIndex={next > thisMonth ? -1 : undefined}
          className={`icon-btn shrink-0 border border-line-strong ${next > thisMonth ? "pointer-events-none opacity-40" : ""}`}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>

      {withBudget.length > 0 && (
        <Card title="All budgeted categories">
          <BudgetMeter spent={totalSpent} budget={totalBudget} currency={currency} />
        </Card>
      )}

      <Card title="Categories" description={`Leave empty for no limit. Amounts in ${currency}.`}>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.categoryId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <CategoryIcon icon={r.icon} color={r.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  {r.budget !== null ? (
                    <div className="mt-1.5">
                      <BudgetMeter spent={r.spent} budget={r.budget} currency={currency} />
                    </div>
                  ) : (
                    <p className="tabular text-sm text-muted">Spent {formatMoney(r.spent, currency)}</p>
                  )}
                </div>
              </div>
              <BudgetForm key={`${r.categoryId}-${r.budget}`} categoryId={r.categoryId} name={r.name} budget={r.budget} currency={currency} canEdit={canEdit} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
