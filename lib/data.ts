import "server-only";
import { ObjectId, type AnyBulkWriteOperation, type ClientSession, type Filter } from "mongodb";
import { db } from "./db";
import { SYSTEM_CATEGORIES, type IconKey, type TxType } from "./category-defs";
import { buckets, toIso, toUtc, type Range } from "./dates";
import { DEFAULT_CURRENCY } from "./money";

// ---------- Documents ----------

type CategoryDoc = {
  _id: ObjectId;
  ledgerId: string | null; // null = system category
  key?: string;
  name: string;
  type: TxType;
  icon: IconKey;
  color: string;
  parentId: ObjectId | null;
  archivedAt: Date | null;
  createdAt: Date;
};

type TransactionDoc = {
  _id: ObjectId;
  ledgerId: string;
  createdBy: string; // userId of whoever entered it
  type: TxType;
  amount: number; // cents
  categoryId: ObjectId; // top-level category
  subcategoryId: ObjectId | null;
  note: string;
  date: Date; // UTC midnight of the calendar day
  createdAt: Date;
  updatedAt: Date;
};

type BudgetDoc = { _id: ObjectId; ledgerId: string; categoryId: ObjectId; amount: number };
type SettingsDoc = { _id: string; currency: string }; // _id = ledgerId

const categories = db.collection<CategoryDoc>("categories");
const transactions = db.collection<TransactionDoc>("transactions");
const budgets = db.collection<BudgetDoc>("budgets");
const settings = db.collection<SettingsDoc>("settings");

// ---------- One-time setup ----------

let setup: Promise<void> | null = null;

/** Migrate userId to ledgerId, create indexes and seed system categories, once per server process. */
export function ensureSetup(): Promise<void> {
  setup ??= (async () => {
    // Legacy per-user data becomes per-ledger data (a solo user's ledger id is their user id).
    // Every step is a no-op once everything is converted.
    const legacy = {
      categories: db.collection("categories"),
      transactions: db.collection("transactions"),
      budgets: db.collection("budgets"),
    };
    // Drop the old indexes first: a unique {userId, categoryId} index would see a renamed budget as
    // (null, categoryId) and reject the next one.
    for (const [collection, name] of [
      [legacy.categories, "userId_1_type_1"],
      [legacy.transactions, "userId_1_date_-1"],
      [legacy.budgets, "userId_1_categoryId_1"],
    ] as const) {
      await collection.dropIndex(name).catch((error) => {
        if (error?.codeName !== "IndexNotFound" && error?.codeName !== "NamespaceNotFound") throw error;
      });
    }

    // Categories and transactions have no unique index that a rename could break (`key` is untouched).
    for (const collection of [legacy.categories, legacy.transactions]) {
      await collection.updateMany({ userId: { $exists: true } }, { $rename: { userId: "ledgerId" } });
    }
    // After the rename, so a transaction written between the steps (by either code version) still gets
    // an author. Before households every ledger had one person, so the ledger id is the author.
    await legacy.transactions.updateMany({ createdBy: { $exists: false } }, [
      { $set: { createdBy: { $ifNull: ["$ledgerId", "$userId"] } } },
    ]);
    // Old code still running during the deploy (or after a rollback) can write a legacy budget for a
    // category its ledger already budgets. The migrated row wins and the legacy one is dropped.
    // Another process may rename `doc` after our read, so never match it against itself, and only
    // delete it while it is still legacy.
    const dropLegacy = (id: ObjectId) => legacy.budgets.deleteOne({ _id: id, userId: { $exists: true } });
    for (const doc of await legacy.budgets.find({ userId: { $exists: true } }).toArray()) {
      const migrated = await legacy.budgets.findOne({
        _id: { $ne: doc._id },
        ledgerId: doc.userId,
        categoryId: doc.categoryId,
      });
      if (migrated) {
        await dropLegacy(doc._id);
        continue;
      }
      await legacy.budgets.updateOne({ _id: doc._id }, { $rename: { userId: "ledgerId" } }).catch(async (error) => {
        if (error?.code !== 11000) throw error;
        await dropLegacy(doc._id); // another process migrated a twin first
      });
    }
    // Before the unique index exists, concurrent cold starts could still leave twins: keep the oldest.
    const twins = await legacy.budgets
      .aggregate<{ ids: ObjectId[] }>([
        { $match: { ledgerId: { $type: "string" } } },
        { $group: { _id: { ledgerId: "$ledgerId", categoryId: "$categoryId" }, ids: { $push: "$_id" }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();
    for (const { ids } of twins) {
      const [, ...extra] = ids.toSorted((a, b) => a.toHexString().localeCompare(b.toHexString()));
      await legacy.budgets.deleteMany({ _id: { $in: extra } });
    }

    await Promise.all([
      categories.createIndex({ ledgerId: 1, type: 1 }),
      categories.createIndex({ key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } }),
      transactions.createIndex({ ledgerId: 1, date: -1 }),
      budgets.createIndex({ ledgerId: 1, categoryId: 1 }, { unique: true }),
    ]);

    const now = new Date();
    for (const type of ["expense", "income"] as const) {
      for (const def of SYSTEM_CATEGORIES[type]) {
        const parent = await categories.findOneAndUpdate(
          { key: def.key },
          {
            $set: { name: def.name, icon: def.icon, color: def.color },
            $setOnInsert: { ledgerId: null, type, parentId: null, archivedAt: null, createdAt: now },
          },
          { upsert: true, returnDocument: "after" },
        );
        for (const child of def.children ?? []) {
          await categories.updateOne(
            { key: `${def.key}/${child}` },
            {
              $set: { name: child, icon: def.icon, color: def.color },
              $setOnInsert: { ledgerId: null, type, parentId: parent!._id, archivedAt: null, createdAt: now },
            },
            { upsert: true },
          );
        }
      }
    }
  })().catch((error) => {
    setup = null;
    throw error;
  });
  return setup;
}

// ---------- Settings ----------

export type Settings = { currency: string };

export async function getSettings(ledgerId: string): Promise<Settings> {
  const doc = await settings.findOne({ _id: ledgerId });
  return { currency: doc?.currency ?? DEFAULT_CURRENCY };
}

export async function updateSettings(ledgerId: string, patch: Settings): Promise<void> {
  await settings.updateOne({ _id: ledgerId }, { $set: patch }, { upsert: true });
}

// ---------- Categories ----------

export type Category = {
  id: string;
  name: string;
  type: TxType;
  icon: IconKey;
  color: string;
  parentId: string | null;
  isSystem: boolean;
  archived: boolean;
};

export type CategoryNode = Category & { children: Category[] };

function toCategory(doc: CategoryDoc): Category {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    type: doc.type,
    icon: doc.icon,
    color: doc.color,
    parentId: doc.parentId?.toHexString() ?? null,
    isSystem: doc.ledgerId === null,
    archived: doc.archivedAt !== null,
  };
}

/**
 * The ledger's own categories plus system ones. `$type: "null"` only matches an explicit null, so a
 * legacy doc that still has `userId` and no `ledgerId` (written by old code) matches neither.
 */
const visibleTo = (ledgerId: string): Filter<CategoryDoc> => ({
  $or: [{ ledgerId }, { ledgerId: { $type: "null" } }],
});

/** System + the user's categories as a tree, system ones first. */
export async function listCategories(
  ledgerId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<CategoryNode[]> {
  await ensureSetup();
  const docs = await categories
    .find({ ...visibleTo(ledgerId), ...(includeArchived ? {} : { archivedAt: null }) })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const all = docs.map(toCategory);
  const byParent = new Map<string, Category[]>();
  for (const c of all) {
    if (c.parentId) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  }
  return all
    .filter((c) => !c.parentId)
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem))
    .map((c) => ({ ...c, children: byParent.get(c.id) ?? [] }));
}

async function findUsableCategory(ledgerId: string, id: string) {
  if (typeof id !== "string" || !ObjectId.isValid(id)) return null;
  return categories.findOne({ _id: new ObjectId(id), ...visibleTo(ledgerId), archivedAt: null });
}

async function findOwnCategory(ledgerId: string, id: string) {
  if (typeof id !== "string" || !ObjectId.isValid(id)) return null;
  return categories.findOne({ _id: new ObjectId(id), ledgerId });
}

export async function createCategory(
  ledgerId: string,
  input: { name: string; type: TxType; icon: IconKey; color: string; parentId: string | null },
): Promise<string | null> {
  await ensureSetup();
  let parentId: ObjectId | null = null;
  let type = input.type;
  if (input.parentId) {
    const parent = await findUsableCategory(ledgerId, input.parentId);
    if (!parent || parent.parentId) return "Pick a top-level parent category.";
    parentId = parent._id;
    type = parent.type;
  }

  const duplicate = await categories.findOne({
    ...visibleTo(ledgerId),
    type,
    parentId,
    archivedAt: null,
    name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
  });
  if (duplicate) return `"${input.name}" already exists here.`;

  await categories.insertOne({
    _id: new ObjectId(),
    ledgerId,
    name: input.name,
    type,
    icon: input.icon,
    color: input.color,
    parentId,
    archivedAt: null,
    createdAt: new Date(),
  });
  return null;
}

export async function updateCategory(
  ledgerId: string,
  id: string,
  input: { name: string; icon: IconKey; color: string },
): Promise<string | null> {
  const doc = await findOwnCategory(ledgerId, id);
  if (!doc) return "Only custom categories can be edited.";
  await categories.updateOne({ _id: doc._id }, { $set: input });
  return null;
}

/** Archive rather than delete, so past transactions keep their category. */
export async function archiveCategory(ledgerId: string, id: string): Promise<string | null> {
  const doc = await findOwnCategory(ledgerId, id);
  if (!doc) return "Only custom categories can be removed.";
  const now = new Date();
  await categories.updateMany(
    { ledgerId, $or: [{ _id: doc._id }, { parentId: doc._id }] },
    { $set: { archivedAt: now } },
  );
  await budgets.deleteMany({ ledgerId, categoryId: doc._id });
  return null;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Transactions ----------

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  date: string;
  note: string;
  categoryId: string;
  subcategoryId: string | null;
  createdBy: string;
};

export type TransactionInput = {
  type: TxType;
  amount: number;
  date: string;
  note: string;
  categoryId: string; // may be a subcategory id
};

/** Resolve a picked category id into (top-level, subcategory). */
async function resolveCategory(ledgerId: string, type: TxType, id: string) {
  const doc = await findUsableCategory(ledgerId, id);
  if (!doc || doc.type !== type) return null;
  return doc.parentId
    ? { categoryId: doc.parentId, subcategoryId: doc._id }
    : { categoryId: doc._id, subcategoryId: null };
}

export async function createTransaction(
  ledgerId: string,
  createdBy: string,
  input: TransactionInput,
): Promise<string | null> {
  await ensureSetup();
  const resolved = await resolveCategory(ledgerId, input.type, input.categoryId);
  if (!resolved) return "Pick a valid category.";
  const now = new Date();
  await transactions.insertOne({
    _id: new ObjectId(),
    ledgerId,
    createdBy,
    type: input.type,
    amount: input.amount,
    note: input.note,
    date: toUtc(input.date),
    ...resolved,
    createdAt: now,
    updatedAt: now,
  });
  return null;
}

export async function updateTransaction(ledgerId: string, id: string, input: TransactionInput): Promise<string | null> {
  if (typeof id !== "string" || !ObjectId.isValid(id)) return "Transaction not found.";
  const resolved = await resolveCategory(ledgerId, input.type, input.categoryId);
  if (!resolved) return "Pick a valid category.";
  const result = await transactions.updateOne(
    { _id: new ObjectId(id), ledgerId },
    {
      $set: {
        type: input.type,
        amount: input.amount,
        note: input.note,
        date: toUtc(input.date),
        ...resolved,
        updatedAt: new Date(),
      },
    },
  );
  return result.matchedCount ? null : "Transaction not found.";
}

export async function deleteTransaction(ledgerId: string, id: string): Promise<void> {
  if (typeof id !== "string" || !ObjectId.isValid(id)) return;
  await transactions.deleteOne({ _id: new ObjectId(id), ledgerId });
}

const inRange = (ledgerId: string, from: string, to: string): Filter<TransactionDoc> => ({
  ledgerId,
  date: { $gte: toUtc(from), $lte: toUtc(to) },
});

export async function listTransactions(ledgerId: string, from: string, to: string): Promise<Transaction[]> {
  const docs = await transactions.find(inRange(ledgerId, from, to)).sort({ date: -1, createdAt: -1 }).toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    type: d.type,
    amount: d.amount,
    date: toIso(d.date),
    note: d.note,
    categoryId: d.categoryId.toHexString(),
    subcategoryId: d.subcategoryId?.toHexString() ?? null,
    createdBy: d.createdBy,
  }));
}

export type DayTotal = { date: string; expense: number; income: number };

export async function dailyTotals(ledgerId: string, from: string, to: string): Promise<DayTotal[]> {
  const rows = await transactions
    .aggregate<{ _id: { date: Date; type: TxType }; total: number }>([
      { $match: inRange(ledgerId, from, to) },
      { $group: { _id: { date: "$date", type: "$type" }, total: { $sum: "$amount" } } },
    ])
    .toArray();
  const map = new Map<string, DayTotal>();
  for (const day of buckets(from, to, "day")) map.set(day, { date: day, expense: 0, income: 0 });
  for (const r of rows) map.get(toIso(r._id.date))![r._id.type] = r.total;
  return [...map.values()];
}

// ---------- Summary ----------

/** `byCategory` maps a top-level category id to its total in the bucket; categories with no transactions are absent. */
export type SeriesPoint = { bucket: string; expense: number; income: number; byCategory: Record<string, number> };
export type CategoryTotal = {
  id: string;
  name: string;
  icon: IconKey;
  color: string;
  amount: number;
  count: number;
  children: { id: string | null; name: string; amount: number }[];
};
export type Summary = {
  expense: number;
  income: number;
  count: number;
  series: SeriesPoint[];
  expenseByCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
};

export async function getSummary(ledgerId: string, range: Range): Promise<Summary> {
  const match = inRange(ledgerId, range.from, range.to);

  const [seriesRows, categoryRows, cats] = await Promise.all([
    transactions
      .aggregate<{ _id: { bucket: Date; type: TxType; cat: ObjectId }; total: number; count: number }>([
        { $match: match },
        {
          $group: {
            _id: {
              bucket: { $dateTrunc: { date: "$date", unit: range.group, timezone: "UTC", startOfWeek: "monday" } },
              type: "$type",
              cat: "$categoryId",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    transactions
      .aggregate<{ _id: { type: TxType; cat: ObjectId; sub: ObjectId | null }; total: number; count: number }>([
        { $match: match },
        {
          $group: {
            _id: { type: "$type", cat: "$categoryId", sub: "$subcategoryId" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    listCategories(ledgerId, { includeArchived: true }),
  ]);

  const series = new Map<string, SeriesPoint>();
  for (const b of buckets(range.from, range.to, range.group)) series.set(b, { bucket: b, expense: 0, income: 0, byCategory: {} });
  let expense = 0;
  let income = 0;
  let count = 0;
  for (const r of seriesRows) {
    const point = series.get(toIso(r._id.bucket));
    if (point) {
      point[r._id.type] += r.total;
      const cat = r._id.cat.toHexString();
      point.byCategory[cat] = (point.byCategory[cat] ?? 0) + r.total;
    }
    if (r._id.type === "expense") expense += r.total;
    else income += r.total;
    count += r.count;
  }

  const names = new Map<string, Category>();
  for (const c of cats) {
    names.set(c.id, c);
    for (const child of c.children) names.set(child.id, child);
  }

  const groups: Record<TxType, Map<string, CategoryTotal>> = { expense: new Map(), income: new Map() };
  for (const r of categoryRows) {
    const id = r._id.cat.toHexString();
    const cat = names.get(id);
    const group = groups[r._id.type];
    const entry =
      group.get(id) ??
      ({
        id,
        name: cat?.name ?? "Unknown",
        icon: cat?.icon ?? "tag",
        color: cat?.color ?? "#94a3b8",
        amount: 0,
        count: 0,
        children: [],
      } satisfies CategoryTotal);
    entry.amount += r.total;
    entry.count += r.count;
    const subId = r._id.sub?.toHexString() ?? null;
    entry.children.push({
      id: subId,
      name: subId ? (names.get(subId)?.name ?? "Unknown") : `${entry.name} (general)`,
      amount: r.total,
    });
    group.set(id, entry);
  }
  const sorted = (m: Map<string, CategoryTotal>) =>
    [...m.values()]
      .map((c) => ({ ...c, children: c.children.sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount);

  return {
    expense,
    income,
    count,
    series: [...series.values()],
    expenseByCategory: sorted(groups.expense),
    incomeByCategory: sorted(groups.income),
  };
}

// ---------- Budgets ----------

export type BudgetStatus = {
  categoryId: string;
  name: string;
  icon: IconKey;
  color: string;
  budget: number | null;
  spent: number;
};

/** Every top-level expense category with its monthly budget (if any) and spend for the month. */
export async function getBudgetStatus(ledgerId: string, monthStart: string, monthEnd: string): Promise<BudgetStatus[]> {
  const [cats, budgetDocs, spentRows] = await Promise.all([
    listCategories(ledgerId),
    budgets.find({ ledgerId }).toArray(),
    transactions
      .aggregate<{ _id: ObjectId; total: number }>([
        { $match: { ...inRange(ledgerId, monthStart, monthEnd), type: "expense" } },
        { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);
  const budgetBy = new Map(budgetDocs.map((b) => [b.categoryId.toHexString(), b.amount]));
  const spentBy = new Map(spentRows.map((r) => [r._id.toHexString(), r.total]));
  return cats
    .filter((c) => c.type === "expense")
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      budget: budgetBy.get(c.id) ?? null,
      spent: spentBy.get(c.id) ?? 0,
    }));
}

export async function setBudget(ledgerId: string, categoryId: string, amount: number | null): Promise<string | null> {
  const cat = await findUsableCategory(ledgerId, categoryId);
  if (!cat || cat.type !== "expense" || cat.parentId) return "Budgets apply to top-level expense categories.";
  if (amount === null) {
    await budgets.deleteOne({ ledgerId, categoryId: cat._id });
  } else {
    await budgets.updateOne({ ledgerId, categoryId: cat._id }, { $set: { amount } }, { upsert: true });
  }
  return null;
}

// ---------- Export ----------

export async function exportRows(ledgerId: string, from: string, to: string) {
  const [txs, cats] = await Promise.all([
    listTransactions(ledgerId, from, to),
    listCategories(ledgerId, { includeArchived: true }),
  ]);
  const names = new Map<string, string>();
  for (const c of cats) {
    names.set(c.id, c.name);
    for (const child of c.children) names.set(child.id, child.name);
  }
  return txs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      type: t.type,
      category: names.get(t.categoryId) ?? "",
      subcategory: t.subcategoryId ? (names.get(t.subcategoryId) ?? "") : "",
      amount: (t.amount / 100).toFixed(2),
      note: t.note,
    }));
}

// ---------- Moving a ledger (accepting a household invite) ----------
// These take an optional session so they can run inside a transaction. Operations in a transaction
// must not overlap, so everything here runs sequentially.

export type LedgerCounts = { transactions: number; categories: number; budgets: number };

/** What a ledger holds: transactions, active custom categories and budgets. */
export async function countLedgerData(ledgerId: string, session?: ClientSession): Promise<LedgerCounts> {
  return {
    transactions: await transactions.countDocuments({ ledgerId }, { session }),
    categories: await categories.countDocuments({ ledgerId, archivedAt: null }, { session }),
    budgets: await budgets.countDocuments({ ledgerId }, { session }),
  };
}

/** Permanently delete everything on a ledger. System categories are untouched. */
export async function deleteLedgerData(ledgerId: string, session?: ClientSession): Promise<void> {
  await transactions.deleteMany({ ledgerId }, { session });
  await budgets.deleteMany({ ledgerId }, { session });
  await categories.deleteMany({ ledgerId }, { session });
  await settings.deleteOne({ _id: ledgerId }, { session });
}

/**
 * Move a ledger's categories, transactions and budgets into another ledger. An active custom category
 * matching an active one visible there (same type, same parent, name ignoring case) is folded into it
 * and archived. The target's budgets and currency win over the source's.
 */
export async function mergeLedgerInto(fromLedgerId: string, toLedgerId: string, session?: ClientSession): Promise<void> {
  const now = new Date();
  const sources = await categories.find({ ledgerId: fromLedgerId }, { session }).toArray();
  const targets = await categories.find({ ...visibleTo(toLedgerId), archivedAt: null }, { session }).toArray();

  // Top-level categories first, so children see their parent's mapping.
  sources.sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null));
  const idMap = new Map<string, ObjectId>();
  const mapped = (id: ObjectId) => idMap.get(id.toHexString()) ?? id;
  const categoryOps: AnyBulkWriteOperation<CategoryDoc>[] = [];
  for (const c of sources) {
    const parentId = c.parentId && mapped(c.parentId);
    const name = c.name.toLowerCase();
    const match =
      c.archivedAt === null
        ? targets.find((t) => t.type === c.type && String(t.parentId) === String(parentId) && t.name.toLowerCase() === name)
        : undefined;
    idMap.set(c._id.toHexString(), match?._id ?? c._id);
    categoryOps.push({
      updateOne: {
        filter: { _id: c._id },
        update: { $set: { ledgerId: toLedgerId, parentId, ...(match ? { archivedAt: now } : {}) } },
      },
    });
  }
  if (categoryOps.length) await categories.bulkWrite(categoryOps, { session });

  const txOps: AnyBulkWriteOperation<TransactionDoc>[] = [];
  for (const [from, to] of idMap) {
    if (from === to.toHexString()) continue;
    const old = new ObjectId(from);
    txOps.push(
      { updateMany: { filter: { ledgerId: fromLedgerId, categoryId: old }, update: { $set: { categoryId: to } } } },
      { updateMany: { filter: { ledgerId: fromLedgerId, subcategoryId: old }, update: { $set: { subcategoryId: to } } } },
    );
  }
  if (txOps.length) await transactions.bulkWrite(txOps, { session });
  await transactions.updateMany({ ledgerId: fromLedgerId }, { $set: { ledgerId: toLedgerId } }, { session });

  // When both ledgers budget the same category, the target's budget wins.
  const sourceBudgets = await budgets.find({ ledgerId: fromLedgerId }, { session }).toArray();
  const targetBudgets = await budgets.find({ ledgerId: toLedgerId }, { session }).toArray();
  const taken = new Set(targetBudgets.map((b) => b.categoryId.toHexString()));
  for (const b of sourceBudgets) {
    const categoryId = mapped(b.categoryId);
    if (taken.has(categoryId.toHexString())) {
      await budgets.deleteOne({ _id: b._id }, { session });
    } else {
      taken.add(categoryId.toHexString());
      await budgets.updateOne({ _id: b._id }, { $set: { ledgerId: toLedgerId, categoryId } }, { session });
    }
  }

  await settings.deleteOne({ _id: fromLedgerId }, { session });
}
