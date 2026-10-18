import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "./auth";
import { connectDb } from "./db";
import { todayIn } from "./dates";
import { resolveLedger, type LedgerContext } from "./household";

export type SessionUser = { id: string; name: string; email: string; image: string | null };

/**
 * Better Auth's session, after making sure the database is connected. Every page, action and route
 * starts here, so a failed connect heals on the next request instead of failing until a redeploy.
 */
export async function getSession() {
  await connectDb();
  return auth.api.getSession({ headers: await headers() });
}

/** The signed-in user, or a redirect to the sign-in page. Deduped per request. */
export const getUser = cache(async (): Promise<SessionUser> => {
  const session = await getSession();
  if (!session) redirect("/");
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});

/** The signed-in user plus the ledger they work in, or a redirect to the sign-in page. Deduped per request. */
export const getLedger = cache(async (): Promise<LedgerContext & { user: SessionUser }> => {
  const user = await getUser();
  return { ...(await resolveLedger(user.id)), user };
});

/** For Server Actions and route handlers: null instead of a redirect. */
export async function getLedgerContext(): Promise<LedgerContext | null> {
  const session = await getSession();
  return session ? resolveLedger(session.user.id) : null;
}

/** The viewer's timezone, written to a cookie by <TimezoneCookie />. */
export async function getTimeZone(): Promise<string> {
  const tz = (await cookies()).get("tz")?.value;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {}
  }
  return "UTC";
}

export async function getToday(): Promise<string> {
  const timeZone = await getTimeZone();
  await connection(); // "today" depends on the clock, so never prerender it
  return todayIn(timeZone);
}
