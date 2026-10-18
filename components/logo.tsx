/** The Pursely mark: a "P" with a ledger line beside its stem. Kept in sync with app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" rx="24" className="fill-primary" />
      <g fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 74V26H55a15 15 0 0 1 0 30H35" strokeWidth="11" />
        <path d="M52 73H66" strokeWidth="7" strokeOpacity="0.72" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
      <LogoMark className="size-9" />
      Pursely
    </span>
  );
}
