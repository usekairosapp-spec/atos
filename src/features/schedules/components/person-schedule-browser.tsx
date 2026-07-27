"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type PersonAssignment = {
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function PersonScheduleBrowser({ people, emptyLabel }: { people: PersonEntry[]; emptyLabel: string }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
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
              {person.assignments.map((assignment, index) => (
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#e2e7ee] pt-2 text-sm" key={index}>
                  <span className="flex items-center gap-2">
                    <strong className="w-11 shrink-0">{assignment.dateLabel}</strong>
                    <span className="text-[#6b767d]">{assignment.departmentName} · {assignment.positionName}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${assignment.labelClass}`}>{assignment.label}</span>
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
