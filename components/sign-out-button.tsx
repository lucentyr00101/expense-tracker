"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/** Icon only by default; `labelled` shows the text, for places where the icon alone is easy to miss. */
export function SignOutButton({ labelled = false }: { labelled?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={labelled ? "btn btn-ghost" : "icon-btn"}
      aria-label={labelled ? undefined : "Sign out"}
      title={labelled ? undefined : "Sign out"}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className={labelled ? "size-4" : "size-5"} aria-hidden />
      {labelled && "Sign out"}
    </button>
  );
}
