"use client";

import { useCallback, useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { removeTransaction } from "@/app/actions";
import type { CategoryNode, Transaction } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { CategoryIcon } from "./category-icon";
import { Modal } from "./modal";
import { TransactionForm } from "./transaction-form";
import { FormError } from "./ui";

type Lookup = Map<string, { name: string; icon: CategoryNode["icon"]; color: string }>;

export function buildLookup(categories: CategoryNode[]): Lookup {
  const map: Lookup = new Map();
  for (const c of categories) {
    map.set(c.id, c);
    for (const s of c.children) map.set(s.id, s);
  }
  return map;
}

type Authors = Record<string, { name: string; image: string | null }>;

export function TransactionList({ transactions, categories, currency, canEdit, authors }: {
  transactions: Transaction[];
  categories: CategoryNode[];
  currency: string;
  canEdit: boolean;
  authors?: Authors;
}) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const lookup = buildLookup(categories);
  const closeEdit = useCallback(() => setEditing(null), []);

  return (
    <>
      <ul className="divide-y divide-line">
        {transactions.map((t) => {
          const cat = lookup.get(t.categoryId);
          const sub = t.subcategoryId ? lookup.get(t.subcategoryId) : null;
          const isIncome = t.type === "income";
          const author = authors?.[t.createdBy];
          const content = (
            <>
              <CategoryIcon icon={cat?.icon ?? "tag"} color={cat?.color ?? "#94a3b8"} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-medium break-words">
                  {cat?.name ?? "Uncategorized"}
                  {sub && <span className="text-muted"> › {sub.name}</span>}
                </span>
                {t.note && <span className="block truncate text-sm text-muted">{t.note}</span>}
              </span>
              <span className={`tabular flex shrink-0 items-center gap-1 font-semibold ${isIncome ? "text-success" : ""}`}>
                {isIncome ? (
                  <ArrowUpRight className="size-4" aria-label="Income" />
                ) : (
                  <ArrowDownRight className="size-4 text-subtle" aria-label="Expense" />
                )}
                {formatMoney(t.amount, currency)}
              </span>
              {author && <AuthorAvatar name={author.name} image={author.image} />}
            </>
          );
          return (
            // The whole row opens the editor, a bigger target than an icon and one less control per row on phones.
            <li key={t.id} className="flex items-center gap-1 py-1.5">
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="group -ml-2 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg py-1.5 pr-2 pl-2 text-left transition-colors duration-150 hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="sr-only">Edit </span>
                    {content}
                    <Pencil className="hidden size-4 shrink-0 text-subtle transition-colors duration-150 group-hover:text-fg sm:block" aria-hidden />
                  </button>
                  <button type="button" className="icon-btn -mr-2 shrink-0 hover:text-danger" aria-label="Delete transaction" onClick={() => setDeleting(t)}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 py-1.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={editing !== null} onClose={closeEdit} title="Edit transaction">
        {editing && (
          <TransactionForm
            categories={categories}
            currency={currency}
            date={editing.date}
            transaction={editing}
            onDone={closeEdit}
          />
        )}
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete transaction?">
        {deleting && <ConfirmDelete transaction={deleting} currency={currency} onDone={() => setDeleting(null)} />}
      </Modal>
    </>
  );
}

function AuthorAvatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google avatar, tiny and remote
    <img
      src={image}
      alt={`Added by ${name}`}
      title={name}
      className="size-5 shrink-0 rounded-full"
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      role="img"
      title={name}
      aria-label={`Added by ${name}`}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ConfirmDelete({ transaction, currency, onDone }: { transaction: Transaction; currency: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        This permanently removes the {transaction.type} of{" "}
        <strong className="tabular text-fg">{formatMoney(transaction.amount, currency)}</strong>. You can&apos;t undo this.
      </p>
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          className="btn btn-danger"
          onClick={() =>
            start(async () => {
              const result = await removeTransaction(transaction.id);
              if (result.ok) onDone();
              else setError(result.error);
            })
          }
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Delete
        </button>
      </div>
    </div>
  );
}
