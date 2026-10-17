"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import type { Granularity, Preset, Range } from "@/lib/dates";
import { setDashboardHref } from "./dashboard-href";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "last", label: "Last N" },
  { value: "custom", label: "Custom" },
];

const UNITS: { value: Granularity; label: string }[] = [
  { value: "day", label: "days" },
  { value: "week", label: "weeks" },
  { value: "month", label: "months" },
  { value: "year", label: "years" },
];

const GROUPS: { value: "" | Granularity; label: string }[] = [
  { value: "", label: "Auto" },
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

type Params = Record<string, string | number | undefined>;

export function RangePicker({ range, groupParam, today }: { range: Range; groupParam?: string; today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preset, setPreset] = useState<Preset>(range.preset);
  const [n, setN] = useState(String(range.n));
  const [unit, setUnit] = useState<Granularity>(range.unit);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);

  function hrefFor(params: Params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ group: groupParam, ...params })) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    return `/dashboard?${qs}`;
  }

  function go(params: Params) {
    start(() => router.push(hrefFor(params), { scroll: false }));
  }

  const current: Params =
    range.preset === "last"
      ? { preset: "last", n: range.n, unit: range.unit }
      : range.preset === "custom"
        ? { preset: "custom", from: range.from, to: range.to }
        : { preset: range.preset, offset: range.offset || undefined };

  const currentHref = hrefFor(current);
  useEffect(() => setDashboardHref(currentHref), [currentHref]);

  function pickPreset(p: Preset) {
    setPreset(p);
    if (p !== "last" && p !== "custom") go({ preset: p });
  }

  const steppable = preset === range.preset && ["today", "week", "month", "year"].includes(range.preset);

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time range" className="flex flex-wrap gap-1 rounded-lg bg-sunken p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={preset === p.value}
              onClick={() => pickPreset(p.value)}
              className={`h-9 cursor-pointer rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                preset === p.value ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Group by
          <select
            value={groupParam ?? ""}
            onChange={(e) => go({ ...current, group: e.target.value || undefined })}
            className="field h-9 w-auto cursor-pointer py-0 text-sm"
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preset === "last" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ preset: "last", n, unit });
          }}
        >
          <span className="pb-2.5 text-sm text-muted">Last</span>
          <input
            aria-label="Number of periods"
            type="number"
            min={1}
            max={1000}
            required
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="field tabular h-9 w-20 text-sm"
          />
          <select
            aria-label="Period"
            value={unit}
            onChange={(e) => setUnit(e.target.value as Granularity)}
            className="field h-9 w-auto cursor-pointer py-0 text-sm"
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary h-9">
            Apply
          </button>
        </form>
      )}

      {preset === "custom" && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ preset: "custom", from, to });
          }}
        >
          <label className="text-sm text-muted">
            From
            <input type="date" required value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field mt-1 h-9 text-sm" />
          </label>
          <label className="text-sm text-muted">
            To
            <input type="date" required value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="field mt-1 h-9 text-sm" />
          </label>
          <button type="submit" className="btn btn-primary h-9">
            Apply
          </button>
        </form>
      )}

      <div className="flex items-center gap-2">
        {steppable && (
          <button
            type="button"
            className="icon-btn size-9"
            aria-label="Previous period"
            onClick={() => go({ preset: range.preset, offset: range.offset - 1 })}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
        <p className="text-sm font-medium" aria-live="polite">
          {range.label}
          <span className="ml-2 font-normal text-subtle">
            {range.days} day{range.days === 1 ? "" : "s"}
            {range.groupAdjusted && " · grouping widened to fit"}
          </span>
        </p>
        {steppable && (
          <button
            type="button"
            className="icon-btn size-9 disabled:opacity-40"
            aria-label="Next period"
            disabled={range.offset >= 0}
            onClick={() => go({ preset: range.preset, offset: range.offset + 1 || undefined })}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        )}
        {pending && <LoaderCircle className="size-4 animate-spin text-subtle" aria-label="Loading" />}
      </div>
    </div>
  );
}
