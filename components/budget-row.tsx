"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { saveBudget, type ActionState } from "@/app/actions";
import { centsToInput } from "@/lib/money";

export function BudgetForm({ categoryId, name, budget, currency, canEdit }: {
  categoryId: string;
  name: string;
  budget: number | null;
  currency: string;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBudget, { ok: false });
  const id = `budget-${categoryId}`;
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Monthly budget for {name} ({currency})
        </label>
        <input
          id={id}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="No limit"
          disabled={!canEdit}
          defaultValue={budget ? centsToInput(budget) : ""}
          aria-describedby={state.error ? `${id}-error` : undefined}
          className="field tabular h-10 min-w-0 flex-1 text-sm sm:w-32 sm:flex-none"
        />
        <button type="submit" disabled={pending || !canEdit} className="btn btn-ghost h-10 shrink-0 px-4">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-label="Saving" /> : "Save"}
        </button>
      </div>
      {state.error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
