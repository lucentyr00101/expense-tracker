import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { BottomNav, SideNav } from "@/components/nav";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
      <aside className="glass sticky top-0 hidden h-dvh flex-col gap-8 border-y-0 border-l-0 p-4 lg:flex">
        <Link href="/dashboard" className="rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-ring">
          <Logo />
        </Link>
        <SideNav />
        <div className="mt-auto">
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-x-0 border-t-0 px-4 lg:hidden">
        <Logo />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
