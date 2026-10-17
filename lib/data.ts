import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { db } from "./db";
import { SYSTEM_CATEGORIES, type IconKey, type TxType } from "./category-defs";
import { buckets, toIso, toUtc, type Range } from "./dates";
import { DEFAULT_CURRENCY } from "./money";

// ---------- Documents ----------

type CategoryDoc = {
  _id: ObjectId;
  userId: string | null; // null = system category
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
  userId: string;
  type: TxType;
  amount: number; // cents
  categoryId: ObjectId; // top-level category
  subcategoryId: ObjectId | null;
  note: string;
  date: Date; // UTC midnight of the calendar day
  createdAt: Date;
  updatedAt: Date;
};

type BudgetDoc = { _id: ObjectId; userId: string; categoryId: ObjectId; amount: number };
type SettingsDoc = { _id: string; currency: string }; // _id = userId

const categories = db.collection<CategoryDoc>("categories");
const transactions = db.collection<TransactionDoc>("transactions");
const budgets = db.collection<BudgetDoc>("budgets");
const settings = db.collection<SettingsDoc>("settings");

// ---------- One-time setup ----------

let setup: Promise<void> | null = null;

/** Create indexes and seed system categories, once per server process. */
function ensureSetup(): Promise<void> {
  setup ??= (async () => {
    await Promise.all([
      categories.createIndex({ userId: 1, type: 1 }),
      categories.createIndex({ key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } }),
      transactions.createIndex({ userId: 1, date: -1 }),
      budgets.createIndex({ userId: 1, categoryId: 1 }, { unique: true }),
    ]);

    const now = new Date();
    for (const type of ["expense", "income"] as const) {
      for (const def of SYSTEM_CATEGORIES[type]) {
        const parent = await categories.findOneAndUpdate(
          { key: def.key },
          {
            $set: { name: def.name, icon: def.icon, color: def.color },
            $setOnInsert: { userId: null, type, parentId: null, archivedAt: null, createdAt: now },
          },
          { upsert: true, returnDocument: "after" },
        );
        for (const child of def.children ?? []) {
          await categories.updateOne(
            { key: `${def.key}/${child}` },
            {
              $set: { name: child, icon: def.icon, color: def.color },
              $setOnInsert: { userId: null, type, parentId: parent!._id, archivedAt: null, createdAt: now },
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

export async function getSettings(userId: string): Promise<Settings> {
  const doc = await settings.findOne({ _id: userId });
  return { currency: doc?.currency ?? DEFAULT_CURRENCY };
}

export async function updateSettings(userId: string, patch: Settings): Promise<void> {
  await settings.updateOne({ _id: userId }, { $set: patch }, { upsert: true });
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
    isSystem: doc.userId === null,
    archived: doc.archivedAt !== null,
  };
}

const visibleTo = (userId: string): Filter<CategoryDoc> => ({ userId: { $in: [null, userId] } });

/** System + the user's categories as a tree, system ones first. */
export async function listCategories(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<CategoryNode[]> {
  await ensureSetup();
  const docs = await categories
    .find({ ...visibleTo(userId), ...(includeArchived ? {} : { archivedAt: null }) })
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

async function findUsableCategory(userId: string, id: string) {
  if (!ObjectId.isValid(id)) return null;
  return categories.findOne({ _id: new ObjectId(id), ...visibleTo(userId), archivedAt: null });
}

async function findOwnCategory(userId: string, id: string) {
  if (!ObjectId.isValid(id)) return null;
  return categories.findOne({ _id: new ObjectId(id), userId });
}

export async function createCategory(
  userId: string,
  input: { name: string; type: TxType; icon: IconKey; color: string; parentId: string | null },
): Promise<string | null> {
  await ensureSetup();
  let parentId: ObjectId | null = null;
  let type = input.type;
  if (input.parentId) {
    const parent = await findUsableCategory(userId, input.parentId);
    if (!parent || parent.parentId) return "Pick a top-level parent category.";
    parentId = parent._id;
    type = parent.type;
  }

  const duplicate = await categories.findOne({
    ...visibleTo(userId),
    type,
    parentId,
    archivedAt: null,
    name: { $regex: `^${escapeRegex(input.name)}$`, $options: "i" },
  });
  if (duplicate) return `"${input.name}" already exists here.`;

  await categories.insertOne({
    _id: new ObjectId(),
    userId,
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
  userId: string,
  id: string,
  input: { name: string; icon: IconKey; color: string },
): Promise<string | null> {
  const doc = await findOwnCategory(userId, id);
  if (!doc) return "Only your own categories can be edited.";
  await categories.updateOne({ _id: doc._id }, { $set: input });
  return null;
}

/** Archive rather than delete, so past transactions keep their category. */
export async function archiveCategory(userId: string, id: string): Promise<string | null> {
  const doc = await findOwnCategory(userId, id);
  if (!doc) return "Only your own categories can be removed.";
  const now = new Date();
  await categories.updateMany(
    { userId, $or: [{ _id: doc._id }, { parentId: doc._id }] },
    { $set: { archivedAt: now } },
  );
  await budgets.deleteMany({ userId, categoryId: doc._id });
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
};

export type TransactionInput = {
  type: TxType;
  amount: number;
  date: string;
  note: string;
  categoryId: string; // may be a subcategory id
};

/** Resolve a picked category id into (top-level, subcategory). */
async function resolveCategory(userId: string, type: TxType, id: string) {
  const doc = await findUsableCategory(userId, id);
  if (!doc || doc.type !== type) return null;
  return doc.parentId
    ? { categoryId: doc.parentId, subcategoryId: doc._id }
    : { categoryId: doc._id, subcategoryId: null };
}

export async function createTransaction(userId: string, input: TransactionInput): Promise<string | null> {
  await ensureSetup();
  const resolved = await resolveCategory(userId, input.type, input.categoryId);
  if (!resolved) return "Pick a valid category.";
  const now = new Date();
  await transactions.insertOne({
    _id: new ObjectId(),
    userId,
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

export async function updateTransaction(userId: string, id: string, input: TransactionInput): Promise<string | null> {
  if (!ObjectId.isValid(id)) return "Transaction not found.";
  const resolved = await resolveCategory(userId, input.type, input.categoryId);
  if (!resolved) return "Pick a valid category.";
  const result = await transactions.updateOne(
    { _id: new ObjectId(id), userId },
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

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  await transactions.deleteOne({ _id: new ObjectId(id), userId });
}

const inRange = (userId: string, from: string, to: string): Filter<TransactionDoc> => ({
  userId,
  date: { $gte: toUtc(from), $lte: toUtc(to) },
});

export async function listTransactions(userId: string, from: string, to: string): Promise<Transaction[]> {
  const docs = await transactions.find(inRange(userId, from, to)).sort({ date: -1, createdAt: -1 }).toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    type: d.type,
    amount: d.amount,
    date: toIso(d.date),
    note: d.note,
    categoryId: d.categoryId.toHexString(),
    subcategoryId: d.subcategoryId?.toHexString() ?? null,
  }));
}

export type DayTotal = { date: string; expense: number; income: number };

export async function dailyTotals(userId: string, from: string, to: string): Promise<DayTotal[]> {
  const rows = await transactions
    .aggregate<{ _id: { date: Date; type: TxType }; total: number }>([
      { $match: inRange(userId, from, to) },
      { $group: { _id: { date: "$date", type: "$type" }, total: { $sum: "$amount" } } },
    ])
    .toArray();
  const map = new Map<string, DayTotal>();
  for (const day of buckets(from, to, "day")) map.set(day, { date: day, expense: 0, income: 0 });
  for (const r of rows) map.get(toIso(r._id.date))![r._id.type] = r.total;
  return [...map.values()];
}

// ---------- Summary ----------

export type SeriesPoint = { bucket: string; expense: number; income: number };
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

export async function getSummary(userId: string, range: Range): Promise<Summary> {
  const match = inRange(userId, range.from, range.to);

  const [seriesRows, categoryRows, cats] = await Promise.all([
    transactions
      .aggregate<{ _id: { bucket: Date; type: TxType }; total: number; count: number }>([
        { $match: match },
        {
          $group: {
            _id: {
              bucket: { $dateTrunc: { date: "$date", unit: range.group, timezone: "UTC", startOfWeek: "monday" } },
              type: "$type",
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
    listCategories(userId, { includeArchived: true }),
  ]);

  const series = new Map<string, SeriesPoint>();
  for (const b of buckets(range.from, range.to, range.group)) series.set(b, { bucket: b, expense: 0, income: 0 });
  let expense = 0;
  let income = 0;
  let count = 0;
  for (const r of seriesRows) {
    const point = series.get(toIso(r._id.bucket));
    if (point) point[r._id.type] += r.total;
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
export async function getBudgetStatus(userId: string, monthStart: string, monthEnd: string): Promise<BudgetStatus[]> {
  const [cats, budgetDocs, spentRows] = await Promise.all([
    listCategories(userId),
    budgets.find({ userId }).toArray(),
    transactions
      .aggregate<{ _id: ObjectId; total: number }>([
        { $match: { ...inRange(userId, monthStart, monthEnd), type: "expense" } },
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

export async function setBudget(userId: string, categoryId: string, amount: number | null): Promise<string | null> {
  const cat = await findUsableCategory(userId, categoryId);
  if (!cat || cat.type !== "expense" || cat.parentId) return "Budgets apply to top-level expense categories.";
  if (amount === null) {
    await budgets.deleteOne({ userId, categoryId: cat._id });
  } else {
    await budgets.updateOne({ userId, categoryId: cat._id }, { $set: { amount } }, { upsert: true });
  }
  return null;
}

// ---------- Export ----------

export async function exportRows(userId: string, from: string, to: string) {
  const [txs, cats] = await Promise.all([
    listTransactions(userId, from, to),
    listCategories(userId, { includeArchived: true }),
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
