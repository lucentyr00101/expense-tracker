"use client";

import { useActionState } from "react";
import { Check, Download, LoaderCircle } from "lucide-react";
import { saveSettings, type ActionState } from "@/app/actions";
import { CURRENCIES } from "@/lib/money";
import { FormError } from "./ui";

export function CurrencyForm({ currency, canEdit }: { currency: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, { ok: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="currency" className="label">
          Display currency
        </label>
        <div className="flex gap-2">
          <select id="currency" name="currency" defaultValue={currency} disabled={!canEdit} className="field min-w-0 flex-1 cursor-pointer sm:max-w-xs">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending || !canEdit} className="btn btn-primary">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Save
          </button>
        </div>
        <p className="mt-1.5 text-sm text-subtle">Changes how amounts are shown. Amounts aren&apos;t converted.</p>
      </div>
      {state.ok && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-success">
          <Check className="size-4" aria-hidden /> Saved
        </p>
      )}
      <FormError message={state.error} />
    </form>
  );
}

export function ExportForm({ from, to }: { from: string; to: string }) {
  return (
    // Phones put the two dates side by side with a full-width button below; wider screens fit one row.
    <form action="/api/export" method="get" className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
      <div className="min-w-0">
        <label htmlFor="export-from" className="label">
          From
        </label>
        <input id="export-from" name="from" type="date" required defaultValue={from} className="field" />
      </div>
      <div className="min-w-0">
        <label htmlFor="export-to" className="label">
          To
        </label>
        <input id="export-to" name="to" type="date" required defaultValue={to} className="field" />
      </div>
      <button type="submit" className="btn btn-ghost col-span-2">
        <Download className="size-4" aria-hidden />
        Download CSV
      </button>
    </form>
  );
}
