import { Wallet } from "lucide-react";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-on-primary">
        <Wallet className="size-5" aria-hidden />
      </span>
      Ledgerly
    </span>
  );
}
