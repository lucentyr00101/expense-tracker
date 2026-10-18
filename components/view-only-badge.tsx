import { getLedger } from "@/lib/session";

export async function ViewOnlyBadge() {
  const { role } = await getLedger();
  if (role !== "viewer") return null;
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line-strong">
      View only
    </span>
  );
}
