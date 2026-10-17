"use client";

import { useSyncExternalStore } from "react";

// The dashboard's last URL, so links back to it keep the range the user picked.
// Kept in memory: a full reload starts again from the default range.
let href = "/dashboard";
const listeners = new Set<() => void>();

export function setDashboardHref(next: string) {
  if (next === href) return;
  href = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDashboardHref() {
  return useSyncExternalStore(subscribe, () => href, () => "/dashboard");
}
