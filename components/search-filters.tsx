"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, SlidersHorizontal, X } from "lucide-react";
import type { CategoryNode } from "@/lib/data";
import { parseAmount } from "@/lib/money";

export type SearchValues = {
  q: string;
  type: string;
  category: string;
  member: string;
  min: string;
  max: string;
  from: string;
  to: string;
};

const EMPTY: SearchValues = { q: "", type: "", category: "", member: "", min: "", max: "", from: "", to: "" };

// Typing waits this long before searching, so each keystroke doesn't fire a query.
const DEBOUNCE_MS = 300;

export function SearchFilters({ initial, categories, members, currency, today }: {
  initial: SearchValues;
  categories: CategoryNode[];
  members?: { userId: string; name: string }[];
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(initial);
  const badMin = values.min !== "" && parseAmount(values.min) === null;
  const badMax = values.max !== "" && parseAmount(values.max) === null;
  // Counts what the server applies; it ignores an amount it can't parse.
  const filterCount = (["type", "category", "member", "from", "to"] as const).filter((k) => values[k]).length
    + Number(values.min !== "" && !badMin) + Number(values.max !== "" && !badMax);
  const [open, setOpen] = useState(filterCount > 0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function update(patch: Partial<SearchValues>, { debounce = false } = {}) {
    const next = { ...values, ...patch };
    setValues(next);
    clearTimeout(timer.current);
    const go = () => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v.trim()) qs.set(k, v.trim());
      start(() => router.replace(`/transactions/search${qs.size ? `?${qs}` : ""}`, { scroll: false }));
    };
    if (debounce) timer.current = setTimeout(go, DEBOUNCE_MS);
    else go();
  }

  const options = categories.filter((c) => !values.type || c.type === values.type);

  return (
    <div className="glass mb-6 flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            type="search"
            value={values.q}
            onChange={(e) => update({ q: e.target.value }, { debounce: true })}
            aria-label="Search notes and categories"
            placeholder="Search"
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            className="field pr-10 pl-10"
          />
          {pending && (
            <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-subtle" aria-hidden />
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          aria-expanded={open}
          aria-controls="search-filters"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          <span className="sr-only sm:not-sr-only">Filters</span>
          {filterCount > 0 && (
            <span className="tabular inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
              {filterCount}
              <span className="sr-only"> active</span>
            </span>
          )}
        </button>
      </div>

      {open && (
        <div id="search-filters" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div>
            <label htmlFor="sf-type" className="label">
              Type
            </label>
            <select
              id="sf-type"
              value={values.type}
              onChange={(e) => {
                const type = e.target.value;
                // A category of the other type can never match, so drop it.
                const keep = !type || categories.some((c) => c.type === type && (c.id === values.category || c.children.some((s) => s.id === values.category)));
                update({ type, ...(!keep && { category: "" }) });
              }}
              className="field cursor-pointer"
            >
              <option value="">All</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div>
            <label htmlFor="sf-category" className="label">
              Category
            </label>
            <select
              id="sf-category"
              value={values.category}
              onChange={(e) => update({ category: e.target.value })}
              className="field cursor-pointer"
            >
              <option value="">All</option>
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
            <label htmlFor="sf-min" className="label">
              Min ({currency})
            </label>
            <input
              id="sf-min"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={values.min}
              onChange={(e) => update({ min: e.target.value }, { debounce: true })}
              aria-invalid={badMin || undefined}
              aria-describedby={badMin ? "sf-min-error" : undefined}
              className="field tabular"
            />
            {badMin && (
              <p id="sf-min-error" className="mt-1 text-xs text-danger">
                Enter an amount like 150 or 99.50
              </p>
            )}
          </div>

          <div>
            <label htmlFor="sf-max" className="label">
              Max ({currency})
            </label>
            <input
              id="sf-max"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Any"
              value={values.max}
              onChange={(e) => update({ max: e.target.value }, { debounce: true })}
              aria-invalid={badMax || undefined}
              aria-describedby={badMax ? "sf-max-error" : undefined}
              className="field tabular"
            />
            {badMax && (
              <p id="sf-max-error" className="mt-1 text-xs text-danger">
                Enter an amount like 150 or 99.50
              </p>
            )}
          </div>

          <div>
            <label htmlFor="sf-from" className="label">
              From
            </label>
            <input
              id="sf-from"
              type="date"
              value={values.from}
              max={values.to || today}
              onChange={(e) => update({ from: e.target.value })}
              className="field cursor-pointer"
            />
          </div>

          <div>
            <label htmlFor="sf-to" className="label">
              To
            </label>
            <input
              id="sf-to"
              type="date"
              value={values.to}
              min={values.from || undefined}
              max={today}
              onChange={(e) => update({ to: e.target.value })}
              className="field cursor-pointer"
            />
          </div>

          {members && (
            <div>
              <label htmlFor="sf-member" className="label">
                Added by
              </label>
              <select
                id="sf-member"
                value={values.member}
                onChange={(e) => update({ member: e.target.value })}
                className="field cursor-pointer"
              >
                <option value="">Anyone</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {Object.values(values).some(Boolean) && (
            <div className="col-span-full flex items-end justify-end lg:col-span-1 lg:col-start-4">
              <button type="button" className="btn btn-ghost" onClick={() => update(EMPTY)}>
                <X className="size-4" aria-hidden />
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
