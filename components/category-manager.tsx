"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { Archive, LoaderCircle, Pencil, Plus } from "lucide-react";
import { removeCategory, saveCategory, type ActionState } from "@/app/actions";
import { CATEGORY_COLORS, ICON_KEYS, type TxType } from "@/lib/category-defs";
import type { Category, CategoryNode } from "@/lib/data";
import { CategoryIcon, ICONS } from "./category-icon";
import { Modal } from "./modal";
import { FormError } from "./ui";

type Dialog =
  | { kind: "create"; type: TxType; parent: CategoryNode | null }
  | { kind: "edit"; category: Category }
  | { kind: "archive"; category: Category };

export function CategoryManager({ categories }: { categories: CategoryNode[] }) {
  const [type, setType] = useState<TxType>("expense");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = useCallback(() => setDialog(null), []);
  const list = categories.filter((c) => c.type === type);

  const title =
    dialog?.kind === "create"
      ? dialog.parent
        ? `New subcategory in ${dialog.parent.name}`
        : `New ${dialog.type} category`
      : dialog?.kind === "edit"
        ? `Edit ${dialog.category.name}`
        : dialog?.kind === "archive"
          ? `Remove ${dialog.category.name}?`
          : "";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Type" className="flex gap-1 rounded-lg bg-sunken p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`h-9 cursor-pointer rounded-md px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring ${
                type === t ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              {t === "expense" ? "Expenses" : "Income"}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "create", type, parent: null })}>
          <Plus className="size-5" aria-hidden />
          New category
        </button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((c) => (
          <li key={c.id} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={c.icon} color={c.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-subtle">
                  {c.isSystem ? "Built-in" : "Custom"} · {c.children.length} subcategor{c.children.length === 1 ? "y" : "ies"}
                </p>
              </div>
              {!c.isSystem && <OwnActions category={c} onDialog={setDialog} />}
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.children.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center rounded-full border border-line text-sm ${s.isSystem ? "px-3 py-1.5 text-muted" : "py-0.5 pr-0.5 pl-3"}`}
                >
                  {s.name}
                  {!s.isSystem && <OwnActions category={s} onDialog={setDialog} compact />}
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "create", type: c.type, parent: c })}
                  className="flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-sm text-muted transition-colors duration-150 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Plus className="size-4" aria-hidden />
                  Subcategory
                </button>
              </li>
            </ul>
          </li>
        ))}
      </ul>

      <Modal open={dialog !== null} onClose={close} title={title}>
        {dialog?.kind === "create" && (
          <CategoryForm type={dialog.type} parent={dialog.parent} onDone={close} />
        )}
        {dialog?.kind === "edit" && <CategoryForm category={dialog.category} type={dialog.category.type} onDone={close} />}
        {dialog?.kind === "archive" && <ConfirmArchive category={dialog.category} onDone={close} />}
      </Modal>
    </>
  );
}

function OwnActions({ category, onDialog, compact }: { category: Category; onDialog: (d: Dialog) => void; compact?: boolean }) {
  const size = compact ? "size-8" : "";
  return (
    <span className="flex">
      <button
        type="button"
        className={`icon-btn ${size}`}
        aria-label={`Edit ${category.name}`}
        onClick={() => onDialog({ kind: "edit", category })}
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className={`icon-btn hover:text-danger ${size}`}
        aria-label={`Remove ${category.name}`}
        onClick={() => onDialog({ kind: "archive", category })}
      >
        <Archive className="size-4" aria-hidden />
      </button>
    </span>
  );
}

function CategoryForm({ type, parent, category, onDone }: {
  type: TxType;
  parent?: CategoryNode | null;
  category?: Category;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCategory, { ok: false });
  const [icon, setIcon] = useState(category?.icon ?? parent?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? parent?.color ?? CATEGORY_COLORS[5]);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="type" value={type} />
      {parent && <input type="hidden" name="parentId" value={parent.id} />}

      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="flex-1">
          <label htmlFor="cat-name" className="label">
            Name
          </label>
          <input id="cat-name" name="name" required maxLength={40} data-autofocus defaultValue={category?.name} className="field" />
        </div>
      </div>

      <fieldset>
        <legend className="label">Icon</legend>
        <div className="grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-lg bg-sunken p-1">
          {ICON_KEYS.map((key) => {
            const Icon = ICONS[key];
            return (
              <label key={key} className="relative">
                <input type="radio" name="icon" value={key} checked={icon === key} onChange={() => setIcon(key)} className="peer sr-only" />
                <span className="flex aspect-square cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-150 peer-checked:bg-surface-strong peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-ring hover:text-fg">
                  <Icon className="size-5" aria-hidden />
                  <span className="sr-only">{key.replace("-", " ")}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c, i) => (
            <label key={c}>
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
              <span
                className="block size-8 cursor-pointer rounded-full ring-offset-2 ring-offset-surface-strong peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
                style={{ backgroundColor: c }}
              >
                <span className="sr-only">Color {i + 1}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormError message={state.error} />
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
        {category ? "Save changes" : "Create"}
      </button>
    </form>
  );
}

function ConfirmArchive({ category, onDone }: { category: Category; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        It disappears from pickers{category.parentId ? "" : ", along with its subcategories and budget"}. Past transactions keep
        this category, so your history and charts stay accurate.
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
              const result = await removeCategory(category.id);
              if (result.ok) onDone();
              else setError(result.error);
            })
          }
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Remove
        </button>
      </div>
    </div>
  );
}
