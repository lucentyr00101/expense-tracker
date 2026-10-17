import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "./auth";
import { todayIn } from "./dates";

export type SessionUser = { id: string; name: string; email: string; image: string | null };

/** The signed-in user, or a redirect to the sign-in page. Deduped per request. */
export const getUser = cache(async (): Promise<SessionUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
});

/** For Server Actions and route handlers: null instead of a redirect. */
export async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
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
