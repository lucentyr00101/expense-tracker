import { getUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu({ labelled = false }: { labelled?: boolean }) {
  const user = await getUser();
  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google avatar, tiny and remote
        <img src={user.image} alt="" className="size-9 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
          {user.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-subtle">{user.email}</p>
      </div>
      <SignOutButton labelled={labelled} />
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="size-9 animate-pulse rounded-full bg-sunken" />
      <span className="h-4 flex-1 animate-pulse rounded bg-sunken" />
    </div>
  );
}
