import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Target } from "lucide-react";
import { getToday, getUser } from "@/lib/session";
import { getBudgetStatus, getSettings, getSummary, listCategories } from "@/lib/data";
import { endOf, resolveRange, startOf, type RangeParams } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { AddTransactionButton } from "@/components/add-transaction-button";
import { BudgetMeter } from "@/components/budget-meter";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { CategoryIcon } from "@/components/category-icon";
import { RangePicker } from "@/components/range-picker";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [user, today, raw] = await Promise.all([getUser(), getToday(), searchParams]);
  const params: RangeParams = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));
  const range = resolveRange(params, today);

  const [summary, settings, categories, budgets] = await Promise.all([
    getSummary(user.id, range),
    getSettings(user.id),
    listCategories(user.id),
    getBudgetStatus(user.id, startOf(today, "month"), endOf(today, "month")),
  ]);
  const { currency } = settings;
  const net = summary.income - summary.expense;
  const budgeted = budgets
    .filter((b) => b.budget !== null)
    .sort((a, b) => b.spent / b.budget! - a.spent / a.budget!)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Here's how your money moved."
        actions={<AddTransactionButton categories={categories} currency={currency} date={today} />}
      />

      <RangePicker range={range} groupParam={params.group} today={today} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Expenses" value={formatMoney(summary.expense, currency)} dot="var(--series-expense)" />
        <Kpi label="Income" value={formatMoney(summary.income, currency)} dot="var(--series-income)" />
        <Kpi label="Net" value={formatMoney(net, currency)} className={net < 0 ? "text-danger" : "text-success"} />
        <Kpi
          label="Avg. spent per day"
          value={formatMoney(Math.round(summary.expense / range.days), currency)}
          hint={`${summary.count} transaction${summary.count === 1 ? "" : "s"}`}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Cash flow" description={`Per ${range.group}`} className="lg:col-span-3">
          <CashFlowChart
            data={summary.series}
            expense={summary.expenseByCategory}
            income={summary.incomeByCategory}
            group={range.group}
            currency={currency}
          />
        </Card>
        <Card title="By category" description="Select a category to see subcategories" className="lg:col-span-2">
          <CategoryBreakdown expense={summary.expenseByCategory} income={summary.incomeByCategory} currency={currency} />
        </Card>
      </div>

      <Card
        title="Budgets this month"
        actions={
          <Link href="/budgets" className="btn btn-ghost h-9 px-3">
            Manage <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {budgeted.length ? (
          <ul className="grid gap-5 sm:grid-cols-2">
            {budgeted.map((b) => (
              <li key={b.categoryId} className="flex items-start gap-3">
                <CategoryIcon icon={b.icon} color={b.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 truncate text-sm font-medium">{b.name}</p>
                  <BudgetMeter spent={b.spent} budget={b.budget!} currency={currency} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Target className="size-8" aria-hidden />} title="No budgets yet">
            Set a monthly limit for a category to track it here.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, hint, dot, className = "" }: { label: string; value: string; hint?: string; dot?: string; className?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <dt className="flex items-center gap-2 text-sm text-muted">
        {dot && <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: dot }} />}
        {label}
      </dt>
      <dd className={`mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl ${className}`}>{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-subtle">{hint}</dd>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy aria-label="Loading dashboard" className="flex flex-col gap-6">
      <Skeleton className="h-16 w-64" />
      <Skeleton className="h-28" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-96 lg:col-span-3" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    </div>
  );
}
