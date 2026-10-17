"use client";

import { useEffect } from "react";

/** Lets the server know the viewer's timezone, so "today" means their today. */
export function TimezoneCookie() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!document.cookie.split("; ").includes(`tz=${encodeURIComponent(tz)}`)) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
