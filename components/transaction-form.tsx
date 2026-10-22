"use client";

import { useActionState, useEffect, useState } from "react";
import { LoaderCircle, Repeat } from "lucide-react";
import { saveTransaction, type ActionState } from "@/app/actions";
import type { CategoryNode, Transaction } from "@/lib/data";
import type { TxType } from "@/lib/category-defs";
import type { Granularity } from "@/lib/dates";
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

  const [repeat, setRepeat] = useState<"" | Granularity>("");

  return (
    <form action={action} className="flex flex-col gap-4">
      {transaction && <input type="hidden" name="id" value={transaction.id} />}
      <input type="hidden" name="type" value={type} />

      <TypeToggle type={type} onChange={setType} />

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

      <CategorySelect id="tx-category" categories={categories} type={type} selected={transaction?.subcategoryId ?? transaction?.categoryId} />

      <div className={transaction ? "" : "grid grid-cols-2 gap-3"}>
        <div className="min-w-0">
          <label htmlFor="tx-date" className="label">
            {repeat ? "Starts" : "Date"}
          </label>
          <input id="tx-date" name="date" type="date" required defaultValue={transaction?.date ?? date} className="field" />
        </div>
        {!transaction && (
          <div className="min-w-0">
            <label htmlFor="tx-repeat" className="label">
              Repeat
            </label>
            <select
              id="tx-repeat"
              name="repeat"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as "" | Granularity)}
              className="field cursor-pointer"
            >
              <option value="">Never</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
        )}
      </div>
      {transaction?.recurringId && (
        <p className="-mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Repeat className="size-4 shrink-0" aria-hidden />
          From a recurring entry. Changes here apply to this one only.
        </p>
      )}

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
        {transaction ? "Save changes" : repeat ? `Add recurring ${type}` : `Add ${type}`}
      </button>
    </form>
  );
}

export function TypeToggle({ type, onChange }: { type: TxType; onChange: (type: TxType) => void }) {
  return (
    <fieldset>
      <legend className="label">Type</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => onChange(t)}
            className={`h-10 cursor-pointer rounded-md text-sm font-semibold capitalize transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
              type === t ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Top-level categories of `type` and their subcategories; picking a subcategory sends its id. */
export function CategorySelect({ id, categories, type, selected = "" }: {
  id: string;
  categories: CategoryNode[];
  type: TxType;
  selected?: string;
}) {
  const options = categories.filter((c) => c.type === type);
  return (
    <div>
      <label htmlFor={id} className="label">
        Category
      </label>
      <select
        id={id}
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
  );
}
