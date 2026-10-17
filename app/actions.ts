"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getUserId } from "@/lib/session";
import * as data from "@/lib/data";
import { CATEGORY_COLORS, ICON_KEYS } from "@/lib/category-defs";
import { isIsoDate } from "@/lib/dates";
import { isCurrency, parseAmount } from "@/lib/money";

export type ActionState = { ok: boolean; error?: string; at?: number };

const fail = (error: string): ActionState => ({ ok: false, error });
const done = (): ActionState => {
  refresh();
  return { ok: true, at: Date.now() };
};

const amount = z.string().transform((v, ctx) => {
  const cents = parseAmount(v);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount greater than 0, with up to 2 decimals." });
    return z.NEVER;
  }
  return cents;
});

const txSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount,
  date: z.string().refine(isIsoDate, "Pick a valid date."),
  categoryId: z.string().min(1, "Pick a category."),
  note: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name.").max(40, "Keep the name under 40 characters."),
  icon: z.enum(ICON_KEYS),
  color: z.enum(CATEGORY_COLORS),
});

function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function fields(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
}

// ---------- Transactions ----------

export async function saveTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  const parsed = txSchema.safeParse(fields(formData));
  if (!parsed.success) return fail(firstError(parsed.error));

  const id = formData.get("id");
  const error =
    typeof id === "string" && id
      ? await data.updateTransaction(userId, id, parsed.data)
      : await data.createTransaction(userId, parsed.data);
  return error ? fail(error) : done();
}

export async function removeTransaction(id: string): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  await data.deleteTransaction(userId, id);
  return done();
}

// ---------- Categories ----------

export async function saveCategory(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  const parsed = categorySchema.safeParse(fields(formData));
  if (!parsed.success) return fail(firstError(parsed.error));

  const id = formData.get("id");
  let error: string | null;
  if (typeof id === "string" && id) {
    error = await data.updateCategory(userId, id, parsed.data);
  } else {
    const type = formData.get("type") === "income" ? "income" : "expense";
    const parentId = formData.get("parentId");
    error = await data.createCategory(userId, {
      ...parsed.data,
      type,
      parentId: typeof parentId === "string" && parentId ? parentId : null,
    });
  }
  return error ? fail(error) : done();
}

export async function removeCategory(id: string): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  const error = await data.archiveCategory(userId, id);
  return error ? fail(error) : done();
}

// ---------- Budgets ----------

export async function saveBudget(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  const categoryId = String(formData.get("categoryId") ?? "");
  const raw = String(formData.get("amount") ?? "").trim();
  let cents: number | null = null;
  if (raw) {
    cents = parseAmount(raw);
    if (cents === null) return fail("Enter a budget greater than 0, or leave it empty to remove it.");
  }
  const error = await data.setBudget(userId, categoryId, cents);
  return error ? fail(error) : done();
}

// ---------- Settings ----------

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await getUserId();
  if (!userId) return fail("Your session expired. Sign in again.");
  const currency = formData.get("currency");
  if (!isCurrency(currency)) return fail("Pick a supported currency.");
  await data.updateSettings(userId, { currency });
  return done();
}
