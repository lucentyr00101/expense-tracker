"use client";

import { useActionState } from "react";
import { Check, Download, LoaderCircle } from "lucide-react";
import { saveSettings, type ActionState } from "@/app/actions";
import { CURRENCIES } from "@/lib/money";
import { FormError } from "./ui";

export function CurrencyForm({ currency }: { currency: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, { ok: false });
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="currency" className="label">
          Display currency
        </label>
        <div className="flex flex-wrap gap-2">
          <select id="currency" name="currency" defaultValue={currency} className="field max-w-xs cursor-pointer">
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="btn btn-primary">
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
    <form action="/api/export" method="get" className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="export-from" className="label">
          From
        </label>
        <input id="export-from" name="from" type="date" required defaultValue={from} className="field" />
      </div>
      <div>
        <label htmlFor="export-to" className="label">
          To
        </label>
        <input id="export-to" name="to" type="date" required defaultValue={to} className="field" />
      </div>
      <button type="submit" className="btn btn-ghost">
        <Download className="size-4" aria-hidden />
        Download CSV
      </button>
    </form>
  );
}
