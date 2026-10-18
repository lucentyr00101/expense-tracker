import { CalendarDays, ChartColumn, FolderTree, Target } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { LegalLinks } from "@/components/legal-links";
import { Logo } from "@/components/logo";

const FEATURES = [
  { icon: CalendarDays, title: "Daily log", text: "Record expenses and income day by day, in a few taps." },
  { icon: ChartColumn, title: "Flexible charts", text: "Daily, weekly, monthly, yearly, or the last N days and weeks." },
  { icon: FolderTree, title: "Your categories", text: "Built-in categories plus your own, with subcategories." },
  { icon: Target, title: "Monthly budgets", text: "Set a limit per category and see how close you are." },
];

export default function Landing() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8 sm:px-6">
      <Logo />
      <section className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Know where your money goes.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted text-pretty">
          A simple daily expense tracker with budgets and charts for any time range.
        </p>
        <div className="mt-8">
          {googleConfigured ? (
            <GoogleSignIn />
          ) : (
            <p role="status" className="glass max-w-xl rounded-xl p-4 text-sm text-muted">
              Google sign-in isn&apos;t set up yet. Add <code className="text-fg">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="text-fg">GOOGLE_CLIENT_SECRET</code> to <code className="text-fg">.env.local</code>,
              then restart the dev server.
            </p>
          )}
        </div>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="glass rounded-2xl p-5">
              <Icon className="size-6 text-accent" aria-hidden />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <LegalLinks />
    </main>
  );
}
