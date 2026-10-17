"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderTree, LayoutDashboard, Settings, Target } from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Daily", icon: CalendarDays },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
              active ? "bg-primary/15 text-fg" : "text-muted hover:bg-sunken hover:text-fg"
            }`}
          >
            <Icon className={`size-5 ${active ? "text-primary dark:text-ring" : ""}`} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${
              active ? "text-fg" : "text-subtle"
            }`}
          >
            <Icon className={`size-5 ${active ? "text-primary dark:text-ring" : ""}`} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
