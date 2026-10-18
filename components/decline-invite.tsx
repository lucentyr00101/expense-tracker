"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { respondToInvite } from "@/app/actions";
import { FormError } from "./ui";

export function DeclineInvite({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="btn btn-ghost h-10"
        onClick={() =>
          start(async () => {
            const result = await respondToInvite(inviteId, "decline");
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        Decline
      </button>
      <FormError message={error} />
    </>
  );
}
