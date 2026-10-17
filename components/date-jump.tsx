"use client";

import { useRouter } from "next/navigation";
import { isIsoDate } from "@/lib/dates";

export function DateJump({ value, max }: { value: string; max: string }) {
  const router = useRouter();
  return (
    <label className="relative">
      <span className="sr-only">Go to date</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => isIsoDate(e.target.value) && router.push(`/transactions?date=${e.target.value}`)}
        className="field w-auto cursor-pointer"
      />
    </label>
  );
}
