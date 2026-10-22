"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 64; // px of (damped) pull needed to trigger a refresh
const MAX_PULL = 96;
const HIDDEN = -48; // indicator offset when idle, tucked under the header

/**
 * Pull down at the top of the page to re-fetch server data.
 * Only active in the installed PWA: browsers already have their own pull-to-refresh,
 * but standalone iOS web apps have none.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const gesture = useRef<{ x: number; y: number; active: boolean; decided: boolean } | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const update = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const onStart = (e: TouchEvent) => {
      // Skip when scrolled, multi-touch, mid-refresh, or inside an open modal.
      if (window.scrollY > 0 || e.touches.length > 1 || refreshingRef.current) return;
      if (document.querySelector("dialog[open]")) return;
      gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false, decided: false };
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = e.touches[0].clientX - g.x;
      const dy = e.touches[0].clientY - g.y;
      if (!g.decided) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        g.decided = true;
        // Horizontal swipes (charts, scrollable rows) and upward scrolls aren't ours.
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          gesture.current = null;
          return;
        }
        g.active = true;
        setDragging(true);
      }
      if (!g.active) return;
      // Stops iOS rubber-banding the page while the indicator follows the finger.
      e.preventDefault();
      update(Math.min(MAX_PULL, Math.max(0, dy * 0.5)));
    };

    const onEnd = () => {
      if (!gesture.current?.active) {
        gesture.current = null;
        return;
      }
      gesture.current = null;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) startRefresh(() => router.refresh());
      update(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const progress = Math.min(1, pull / THRESHOLD);
  const offset = refreshing ? 16 : HIDDEN + pull;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center lg:top-0 ${
        dragging ? "" : "transition-[transform,opacity] duration-200"
      }`}
      // Invisible at rest so it never shows through the translucent header.
      style={{ transform: `translateY(${offset}px)`, opacity: refreshing || pull > 0 ? 1 : 0 }}
    >
      <div className="glass flex size-10 items-center justify-center rounded-full shadow-sm">
        <RefreshCw
          aria-hidden
          className={`size-5 text-primary ${refreshing ? "motion-safe:animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}
        />
      </div>
      <span role="status" className="sr-only">
        {refreshing ? "Refreshing" : ""}
      </span>
    </div>
  );
}
