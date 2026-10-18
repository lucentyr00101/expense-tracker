import Link from "next/link";

export const CONTACT_EMAIL = "sarcosredilbertranz@gmail.com";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={`flex gap-4 text-sm text-subtle ${className}`}>
      <Link href="/privacy" className="hover:text-fg hover:underline">
        Privacy Policy
      </Link>
      <Link href="/terms" className="hover:text-fg hover:underline">
        Terms of Service
      </Link>
    </nav>
  );
}
