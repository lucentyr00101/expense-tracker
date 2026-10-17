import { CircleCheck, OctagonAlert, TriangleAlert } from "lucide-react";
import { formatMoney } from "@/lib/money";

/** Spend vs budget, with status carried by icon + label, not color alone. */
export function BudgetMeter({ spent, budget, currency }: { spent: number; budget: number; currency: string }) {
  const ratio = spent / budget;
  const status =
    ratio > 1
      ? { label: "Over budget", Icon: OctagonAlert, text: "text-danger", bar: "bg-danger" }
      : ratio >= 0.8
        ? { label: "Close to limit", Icon: TriangleAlert, text: "text-warning", bar: "bg-warning" }
        : { label: "On track", Icon: CircleCheck, text: "text-success", bar: "bg-success" };
  const left = budget - spent;

  return (
    <div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(spent, budget)}
        aria-valuetext={`${formatMoney(spent, currency)} of ${formatMoney(budget, currency)} spent. ${status.label}.`}
        className="h-2 overflow-hidden rounded-full bg-sunken"
      >
        <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs">
        <span className={`flex items-center gap-1 font-medium ${status.text}`}>
          <status.Icon className="size-3.5" aria-hidden />
          {status.label}
        </span>
        <span className="tabular text-muted">
          {formatMoney(spent, currency)} / {formatMoney(budget, currency)} ·{" "}
          {left >= 0 ? `${formatMoney(left, currency)} left` : `${formatMoney(-left, currency)} over`}
        </span>
      </div>
    </div>
  );
}
