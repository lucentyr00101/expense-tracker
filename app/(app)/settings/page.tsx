import { Suspense } from "react";
import type { Metadata } from "next";
import { getToday, getLedger } from "@/lib/session";
import { getSettings } from "@/lib/data";
import { startOf } from "@/lib/dates";
import { CurrencyForm, ExportForm } from "@/components/settings-forms";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";
import { Card, PageHeader, Skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-2xl flex-col gap-6">
        <Card title="Account">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </Card>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Preferences />
        </Suspense>
      </div>
    </>
  );
}

async function Preferences() {
  const [ledger, today] = await Promise.all([getLedger(), getToday()]);
  const { currency } = await getSettings(ledger.ledgerId);
  return (
    <>
      <Card title="Currency">
        <CurrencyForm currency={currency} />
      </Card>
      <Card title="Export" description="Download your transactions as a CSV file for Excel or Google Sheets.">
        <ExportForm from={startOf(today, "year")} to={today} />
      </Card>
    </>
  );
}
