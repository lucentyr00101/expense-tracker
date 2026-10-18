import Link from "next/link";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";

export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:px-6">
      <Link href="/" className="self-start rounded-lg px-1 focus-visible:outline-2 focus-visible:outline-ring">
        <Logo />
      </Link>
      <main className="glass mt-8 rounded-2xl p-6 sm:p-10 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:leading-relaxed">
        {children}
      </main>
      <LegalLinks className="mt-6" />
    </div>
  );
}
