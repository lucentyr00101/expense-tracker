import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { connectDb } from "@/lib/db";

const handler = toNextJsHandler(auth);

// Sign-in and session reads hit the database directly, so reconnect first (see connectDb).
export async function GET(request: Request) {
  await connectDb();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await connectDb();
  return handler.POST(request);
}
