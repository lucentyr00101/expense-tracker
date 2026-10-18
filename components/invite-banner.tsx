import { getAcceptPreview, listIncomingInvites } from "@/lib/household";
import { getLedger } from "@/lib/session";
import { AcceptInvite } from "./accept-invite";
import { DeclineInvite } from "./decline-invite";

export async function InviteBanner() {
  const ledger = await getLedger();
  const invites = await listIncomingInvites(ledger, ledger.user.email);
  if (!invites.length) return null;
  const previews = await Promise.all(invites.map((i) => getAcceptPreview(ledger, ledger.user.email, i.id)));

  return (
    <div className="mb-6 flex flex-col gap-3">
      {invites.map((invite, i) => {
        const preview = previews[i];
        if (!preview) return null;
        return (
          <section key={invite.id} aria-label="Household invitation" className="glass rounded-2xl p-4">
            <p className="text-sm font-medium">
              {invite.ownerName} invited you to their household as {invite.role === "editor" ? "an editor" : "a viewer"}.
            </p>
            {invite.blocked && (
              <p className="mt-1 text-sm text-muted">
                {ledger.role === "owner"
                  ? "Transfer ownership or remove your members in Settings first."
                  : "Leave your current household in Settings first."}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {invite.blocked ? <DeclineInvite inviteId={invite.id} /> : <AcceptInvite invite={invite} preview={preview} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
