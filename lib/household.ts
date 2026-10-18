import "server-only";
import { ObjectId } from "mongodb";
import { db } from "./db";
import { ensureSetup } from "./data";

export type Role = "owner" | "editor" | "viewer";

/** Whose data the signed-in user is looking at, and what they may do with it. */
export type LedgerContext = { userId: string; ledgerId: string; role: Role; householdId: string | null };

export type HouseholdDoc = {
  _id: ObjectId;
  ledgerId: string;
  ownerId: string;
  members: { userId: string; role: Role; joinedAt: Date }[];
};

/** Pins a user to a ledger other than their own (e.g. after leaving a household). */
export type UserLedgerDoc = { _id: string; ledgerId: string }; // _id = userId

export const households = db.collection<HouseholdDoc>("households");
export const userLedgers = db.collection<UserLedgerDoc>("userLedgers");

/** The ledger a user works in: their household's, a pinned one, or their own. */
export async function resolveLedger(userId: string): Promise<LedgerContext> {
  await ensureSetup();
  const household = await households.findOne({ "members.userId": userId });
  if (household) {
    const member = household.members.find((m) => m.userId === userId)!;
    return { userId, ledgerId: household.ledgerId, role: member.role, householdId: household._id.toHexString() };
  }
  const pinned = await userLedgers.findOne({ _id: userId });
  if (pinned) return { userId, ledgerId: pinned.ledgerId, role: "owner", householdId: null };
  return { userId, ledgerId: userId, role: "owner", householdId: null };
}
