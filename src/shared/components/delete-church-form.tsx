"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

export function DeleteChurchForm({ action, churchId, churchName }: { action: (formData: FormData) => void | Promise<void>; churchId: string; churchName: string }) {
  const [typedName, setTypedName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const ready = typedName === churchName && acknowledged;

  return <form action={action} className="mt-5 rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-950 dark:bg-red-950/20" onSubmit={(event) => {
    if (!ready || !window.confirm(`ÚLTIMA CONFIRMAÇÃO: excluir permanentemente a igreja “${churchName}” e todos os seus dados?`)) event.preventDefault();
  }}>
    <input name="churchId" type="hidden" value={churchId} />
    <input name="expectedName" type="hidden" value={churchName} />
    <p className="font-bold text-red-800 dark:text-red-300">Excluir permanentemente</p>
    <p className="mt-1 text-sm text-red-700 dark:text-red-300">Isso apagará membros vinculados, setores, escalas, notificações e configurações desta igreja. As contas pessoais continuarão existindo.</p>
    <label className="mt-4 block text-sm font-semibold text-red-900 dark:text-red-200">Digite exatamente: <strong>{churchName}</strong><input autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-red-300 bg-white px-3 text-[var(--foreground)] dark:bg-[var(--surface)]" onChange={(event) => setTypedName(event.target.value)} value={typedName} /></label>
    <label className="mt-3 flex items-start gap-3 text-sm text-red-900 dark:text-red-200"><input className="mt-1 h-4 w-4" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />Entendo que esta exclusão não poderá ser desfeita.</label>
    <PendingSubmitButton className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-5 font-bold text-white disabled:bg-red-300" disabled={!ready} pendingLabel="Excluindo igreja..."><Trash2 size={18} />Excluir igreja</PendingSubmitButton>
  </form>;
}
