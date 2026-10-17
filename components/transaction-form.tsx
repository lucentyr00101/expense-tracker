"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { saveTransaction, type ActionState } from "@/app/actions";
import type { CategoryNode, Transaction } from "@/lib/data";
import type { TxType } from "@/lib/category-defs";
import { centsToInput } from "@/lib/money";
import { FormError } from "./ui";

export function TransactionForm({ categories, currency, date, transaction, onDone }: {
  categories: CategoryNode[];
  currency: string;
  date: string;
  transaction?: Transaction;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTransaction, { ok: false });
  const [type, setType] = useState<TxType>(transaction?.type ?? "expense");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const options = categories.filter((c) => c.type === type);
  const selected = transaction?.subcategoryId ?? transaction?.categoryId ?? "";

  return (
    <form action={action} className="flex flex-col gap-4">
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="type" value={type} />

      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`h-10 cursor-pointer rounded-md text-sm font-semibold capitalize transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                type === t ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="tx-amount" className="label">
          Amount ({currency})
        </label>
        <input
          id="tx-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          required
          data-autofocus
          placeholder="0.00"
          defaultValue={transaction ? centsToInput(transaction.amount) : ""}
          className="field tabular text-lg font-semibold"
        />
      </div>

      <div>
        <label htmlFor="tx-category" className="label">
          Category
        </label>
        <select
          id="tx-category"
          name="categoryId"
          required
          key={type}
          defaultValue={options.some((c) => c.id === selected || c.children.some((s) => s.id === selected)) ? selected : ""}
          className="field cursor-pointer"
        >
          <option value="" disabled>
            Choose a category
          </option>
          {options.map((c) => (
            <optgroup key={c.id} label={c.name}>
              <option value={c.id}>{c.name}</option>
              {c.children.map((s) => (
                <option key={s.id} value={s.id}>
                  {c.name} › {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="tx-date" className="label">
          Date
        </label>
        <input id="tx-date" name="date" type="date" required defaultValue={transaction?.date ?? date} className="field" />
      </div>

      <div>
        <label htmlFor="tx-note" className="label">
          Note <span className="font-normal text-subtle">(optional)</span>
        </label>
        <input
          id="tx-note"
          name="note"
          maxLength={200}
          placeholder="e.g. Lunch with team"
          defaultValue={transaction?.note ?? ""}
          className="field"
        />
      </div>

      <FormError message={state.error} />

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {transaction ? "Save changes" : `Add ${type}`}
      </button>
    </form>
  );
}
