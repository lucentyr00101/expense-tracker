"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import type { CategoryNode } from "@/lib/data";
import { Modal } from "./modal";
import { TransactionForm } from "./transaction-form";

export function AddTransactionButton({ categories, currency, date, canEdit }: {
  categories: CategoryNode[];
  currency: string;
  date: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!canEdit) return null;
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-5" aria-hidden />
        Add transaction
      </button>
      <Modal open={open} onClose={close} title="New transaction">
        <TransactionForm categories={categories} currency={currency} date={date} onDone={close} />
      </Modal>
    </>
  );
}
