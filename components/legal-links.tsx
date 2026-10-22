import Link from "next/link";

export const CONTACT_EMAIL = "sarcosredilbertranz@gmail.com";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex gap-4 text-sm text-subtle ${className}`}>
      <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
        Privacy Policy
      </Link>
      <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
        Terms of Service
      </Link>
    </nav>
  );
}
