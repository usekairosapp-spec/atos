"use client";

import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getSwapCandidatesForLeader, leaderSwapAssignment } from "../actions";

export type PersonAssignment = {
  assignmentId: string;
  scheduleId: string;
  positionId: string;
  dateLabel: string;
  departmentName: string;
  positionName: string;
  label: string;
  labelClass: string;
};

export type PersonEntry = {
  userId: string;
  name: string;
  assignments: PersonAssignment[];
};

type Candidate = { userId: string; name: string; hasConflict: boolean; conflictLabel: string | null };

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

function SwapPanel({ assignment, personName, onDone }: { assignment: PersonAssignment; personName: string; onDone: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getSwapCandidatesForLeader(assignment.assignmentId).then((result) => { if (!cancelled) { setCandidates(result); setLoading(false); } });
    return () => { cancelled = true; };
  }, [assignment.assignmentId]);

  const selected = candidates?.find((item) => item.userId === selectedId) ?? null;

  function confirm() {
    if (!selected) return;
    const formData = new FormData();
    formData.set("assignmentId", assignment.assignmentId);
    formData.set("scheduleId", assignment.scheduleId);
    formData.set("positionId", assignment.positionId);
    formData.set("newUserId", selected.userId);
    startTransition(async () => { await leaderSwapAssignment(formData); onDone(); });
  }

  return <div className="mt-1 rounded-xl border border-dashed border-[var(--church-brand)] bg-[var(--background)] p-3">
    <p className="flex items-center gap-1 text-xs font-bold text-[var(--church-brand-on-soft)]"><RefreshCw size={13} />Trocar {personName} · {assignment.positionName} ({assignment.dateLabel}):</p>
    {loading ? <p className="mt-2 text-xs text-[#6b767d]">Carregando...</p> : null}
    {!loading && !candidates?.length ? <p className="mt-2 text-xs text-[#6b767d]">Ninguém mais disponível neste setor.</p> : null}
    <div className="mt-2 space-y-1">
      {candidates?.map((candidate) => <label className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${selectedId === candidate.userId ? "bg-[var(--church-brand-soft)]" : ""}`} key={candidate.userId}>
        <input checked={selectedId === candidate.userId} name="candidate" onChange={() => setSelectedId(candidate.userId)} type="radio" />
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-[var(--church-brand-on-soft)]">{initialsOf(candidate.name)}</span>
        <span className="flex-1 font-semibold">{candidate.name}</span>
        {candidate.hasConflict ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">já tem escala</span> : null}
      </label>)}
    </div>
    {selected?.hasConflict ? <p className="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-900">⚠️ {selected.name} {selected.conflictLabel ?? "já tem outro compromisso nesse horário"}. Tem certeza que quer trocar mesmo assim?</p> : null}
    {selected ? <button className={`mt-2 flex min-h-9 w-full items-center justify-center rounded-lg text-xs font-bold text-white disabled:opacity-60 ${selected.hasConflict ? "bg-amber-700" : "bg-[var(--church-brand)]"}`} disabled={isPending} onClick={confirm} type="button">{isPending ? "Trocando..." : selected.hasConflict ? "Confirmar mesmo assim" : `Confirmar troca com ${selected.name}`}</button> : null}
    <button className="mt-2 w-full text-center text-xs font-semibold text-[#6b767d]" onClick={onDone} type="button">Cancelar</button>
  </div>;
}

export function PersonScheduleBrowser({ people, emptyLabel, canSwap }: { people: PersonEntry[]; emptyLabel: string; canSwap?: boolean }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const visible = useMemo(() => people.filter((person) => person.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [people, query]);

  return <div>
    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#d7dee7] bg-white px-4"><Search size={19} /><span className="sr-only">Buscar por nome</span><input className="w-full bg-transparent outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" type="search" value={query} /></label>

    <div className="mt-4 space-y-2">
      {visible.map((person) => {
        const isOpen = openId === person.userId;
        return <div className="overflow-hidden rounded-2xl bg-white shadow-sm" key={person.userId}>
          <button className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isOpen ? "bg-[var(--church-brand-soft)]" : ""}`} onClick={() => setOpenId(isOpen ? null : person.userId)} type="button">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--church-brand-soft)] text-sm font-bold text-[var(--church-brand-on-soft)]">{initialsOf(person.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{person.name}</span>
              <span className="block text-xs text-[#6b767d]">{person.assignments.length ? `${person.assignments.length} ${person.assignments.length === 1 ? "escala agendada" : "escalas agendadas"}` : emptyLabel}</span>
            </span>
            <ChevronDown className={`shrink-0 text-[#6b767d] transition-transform ${isOpen ? "rotate-180 text-[var(--church-brand)]" : ""}`} size={18} />
          </button>
          {isOpen ? (
            <div className="space-y-2 px-4 pb-4">
              {person.assignments.map((assignment) => (
                <div className="border-t border-dashed border-[#e2e7ee] pt-2" key={assignment.assignmentId}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <strong className="w-11 shrink-0">{assignment.dateLabel}</strong>
                      <span className="text-[#6b767d]">{assignment.departmentName} · {assignment.positionName}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assignment.labelClass}`}>{assignment.label}</span>
                      {canSwap && assignment.assignmentId ? <button aria-label="Trocar pessoa" className={`grid h-7 w-7 place-items-center rounded-full border ${swapKey === assignment.assignmentId ? "border-[var(--church-brand)] bg-[var(--church-brand)] text-white" : "border-[#d7dee7] text-[var(--church-brand)]"}`} onClick={() => setSwapKey(swapKey === assignment.assignmentId ? null : assignment.assignmentId)} type="button"><RefreshCw size={13} /></button> : null}
                    </span>
                  </div>
                  {swapKey === assignment.assignmentId ? <SwapPanel assignment={assignment} onDone={() => setSwapKey(null)} personName={person.name} /> : null}
                </div>
              ))}
              {!person.assignments.length ? <p className="border-t border-dashed border-[#e2e7ee] pt-2 text-sm text-[#6b767d]">Nenhuma escala nesse período.</p> : null}
            </div>
          ) : null}
        </div>;
      })}
      {!visible.length ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#6b767d] shadow-sm">Ninguém encontrado.</p> : null}
    </div>
  </div>;
}
