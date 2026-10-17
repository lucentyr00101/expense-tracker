import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { getToday, getUser } from "@/lib/session";
import { dailyTotals, getSettings, listCategories, listTransactions } from "@/lib/data";
import { addDays, formatDate, isIsoDate, startOf } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { AddTransactionButton } from "@/components/add-transaction-button";
import { DateJump } from "@/components/date-jump";
import { TransactionList } from "@/components/transaction-list";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Daily log" };

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <Suspense fallback={<DailySkeleton />}>
      <Daily searchParams={searchParams} />
    </Suspense>
  );
}

async function Daily({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  const [user, today, params] = await Promise.all([getUser(), getToday(), searchParams]);
  const date = isIsoDate(params.date) ? params.date : today;
  const weekStart = startOf(date, "week");

  const [categories, settings, transactions, week] = await Promise.all([
    listCategories(user.id),
    getSettings(user.id),
    listTransactions(user.id, date, date),
    dailyTotals(user.id, weekStart, addDays(weekStart, 6)),
  ]);
  const { currency } = settings;
  const spent = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const earned = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const weekMax = Math.max(1, ...week.map((d) => d.expense));

  return (
    <>
      <PageHeader
        title="Daily log"
        description={formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        actions={<AddTransactionButton categories={categories} currency={currency} date={date} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/transactions?date=${addDays(date, -1)}`} className="icon-btn border border-line-strong" aria-label="Previous day">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <DateJump value={date} max={today} />
        <Link
          href={`/transactions?date=${addDays(date, 1)}`}
          aria-label="Next day"
          aria-disabled={date >= today}
          className={`icon-btn border border-line-strong ${date >= today ? "pointer-events-none opacity-40" : ""}`}
          tabIndex={date >= today ? -1 : undefined}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
        {date !== today && (
          <Link href="/transactions" className="btn btn-ghost">
            Today
          </Link>
        )}
      </div>

      <nav aria-label="This week" className="mb-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {week.map((d) => {
          const active = d.date === date;
          const future = d.date > today;
          return (
            <Link
              key={d.date}
              href={`/transactions?date=${d.date}`}
              aria-current={active ? "date" : undefined}
              aria-disabled={future}
              tabIndex={future ? -1 : undefined}
              className={`glass flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                active ? "border-ring! bg-primary/15" : "hover:bg-sunken"
              } ${future ? "pointer-events-none opacity-40" : ""}`}
            >
              <span className="text-xs text-muted">{formatDate(d.date, { weekday: "short" })}</span>
              <span className="text-lg font-semibold">{Number(d.date.slice(8))}</span>
              <span className="h-1 w-full max-w-8 overflow-hidden rounded-full bg-sunken" aria-hidden>
                <span className="block h-full rounded-full bg-expense" style={{ width: `${(d.expense / weekMax) * 100}%` }} />
              </span>
              <span className="tabular hidden text-xs text-muted sm:block">
                {d.expense ? formatMoney(d.expense, currency, { compact: true }) : "—"}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Spent" value={formatMoney(spent, currency)} />
        <Stat label="Earned" value={formatMoney(earned, currency)} />
        <Stat label="Net" value={formatMoney(earned - spent, currency)} tone={earned - spent < 0 ? "danger" : "success"} />
      </div>

      <Card title="Transactions">
        {transactions.length ? (
          <TransactionList transactions={transactions} categories={categories} currency={currency} />
        ) : (
          <EmptyState icon={<Receipt className="size-8" aria-hidden />} title="Nothing logged for this day">
            Use <strong className="text-fg">Add transaction</strong> to record an expense or income.
          </EmptyState>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="glass rounded-xl p-3 sm:p-4">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className={`tabular mt-1 truncate font-semibold sm:text-xl ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DailySkeleton() {
  return (
    <div aria-busy aria-label="Loading daily log" className="flex flex-col gap-6">
      <Skeleton className="h-16 w-72" />
      <Skeleton className="h-11 w-64" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
