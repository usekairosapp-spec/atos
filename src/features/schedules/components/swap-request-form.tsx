"use client";

import Image from "next/image";
import { Check, ChevronRight, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { requestAssignmentSwap } from "@/features/schedules/actions";

type Candidate = { id: string; name: string; avatarUrl: string | null; roles: string[] };

export function SwapRequestForm({ assignmentId, scheduleId, candidates }: { assignmentId: string; scheduleId: string; candidates: Candidate[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const visible = useMemo(() => candidates.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [candidates, query]);

  return <form action={requestAssignmentSwap} className="mt-7">
    <input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="scheduleId" value={scheduleId} /><input type="hidden" name="suggestedUserId" value={selectedId} />
    <h2 className="text-xl font-bold">Selecione alguém para trocar</h2><p className="mt-1 text-sm text-[#6b767d]">A pessoa escolhida receberá o convite e poderá aceitar ou recusar diretamente.</p>
    <label className="mt-5 flex min-h-14 items-center gap-3 rounded-2xl border border-[#d7dee7] bg-white px-4"><Search size={21} /><span className="sr-only">Buscar por nome</span><input className="w-full bg-transparent outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" type="search" value={query} /></label>
    <div className="mt-4 divide-y divide-[#eaeef3] rounded-2xl bg-white px-3 shadow-sm">{visible.map((candidate) => { const selected = selectedId === candidate.id; return <button className={`flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left ${selected ? "bg-[var(--church-brand-soft)]" : ""}`} key={candidate.id} onClick={() => setSelectedId(selected ? "" : candidate.id)} type="button">{candidate.avatarUrl ? <Image alt="" className="h-12 w-12 rounded-full object-cover" height={48} src={candidate.avatarUrl} width={48} /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--church-brand-soft)] text-[var(--church-brand)]"><UserRound /></span>}<span className="min-w-0 flex-1"><strong className="block truncate">{candidate.name}</strong><span className="block truncate text-sm text-[#6b767d]">{candidate.roles.join(" • ") || "Membro do setor"}</span></span>{selected ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--church-brand)] text-white"><Check size={18} /></span> : <ChevronRight className="text-[#717880]" size={21} />}</button>; })}{!visible.length ? <p className="py-8 text-center text-sm text-[#6b767d]">Nenhuma pessoa encontrada.</p> : null}</div>
    <label className="mt-7 block text-lg font-bold">Observação (opcional)<textarea className="mt-3 min-h-28 w-full rounded-2xl border border-[#d7dee7] bg-white p-4 outline-none focus:border-[var(--church-brand)]" maxLength={500} name="reason" placeholder="Explique o motivo da troca..." /></label>
    <button className="mt-6 min-h-14 w-full rounded-2xl bg-gradient-to-r from-[var(--church-brand)] to-[var(--church-brand-dark)] px-5 font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedId}>Enviar solicitação</button>
  </form>;
}
