"use client";

import Link from "next/link";
import { CalendarClock, CheckSquare, Square, Trash2, X } from "lucide-react";
import { useState } from "react";
import { deleteSchedulesBatch, replicateSchedulesToNextMonth } from "../actions";

export type ScheduleCardData = {
  id: string;
  href: string;
  day: string;
  month: string;
  weekdayTime: string;
  departmentName: string;
  subtitle: string;
  label: string;
  labelClass: string;
};

export function ScheduleSelectableList({ schedules, canSelect }: { schedules: ScheduleCardData[]; canSelect: boolean }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<"excluir" | "replicar" | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirming(null);
  }

  return <div>
    {canSelect ? <div className="mb-4 flex justify-end">
      {selectMode
        ? <button className="text-sm font-semibold text-[#6b767d]" onClick={exitSelectMode} type="button">Cancelar seleção</button>
        : <button className="text-sm font-semibold text-[var(--church-brand)]" onClick={() => setSelectMode(true)} type="button">Selecionar escalas</button>}
    </div> : null}

    <div className="space-y-4 pb-28">
      {schedules.map((schedule) => {
        const isSelected = selected.has(schedule.id);
        const card = <>
          <div className="grid place-content-center border-r border-[#eaeef3] p-4 text-center">
            <strong className="text-4xl font-medium">{schedule.day}</strong>
            <span className="mt-1 font-semibold uppercase text-[#50585f]">{schedule.month}</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-[#6b767d]">{schedule.weekdayTime}</p>
            <strong className="mt-1 block text-lg">{schedule.departmentName}</strong>
            <p className="mt-1 text-[#50585f]">{schedule.subtitle}</p>
            <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${schedule.labelClass}`}>{schedule.label}</span>
          </div>
        </>;
        if (selectMode) {
          return <button className={`grid w-full grid-cols-[2.5rem_5.5rem_1fr] items-stretch overflow-hidden rounded-[1.5rem] bg-white text-left shadow-sm transition ${isSelected ? "ring-2 ring-[var(--church-brand)]" : ""}`} key={schedule.id} onClick={() => toggle(schedule.id)} type="button">
            <span className="grid place-items-center border-r border-[#eaeef3]">{isSelected ? <CheckSquare className="text-[var(--church-brand)]" /> : <Square className="text-[#c6d0dc]" />}</span>
            {card}
          </button>;
        }
        return <Link className="grid grid-cols-[5.5rem_1fr] overflow-hidden rounded-[1.5rem] bg-white shadow-sm transition hover:-translate-y-0.5" href={schedule.href} key={schedule.id}>{card}</Link>;
      })}
    </div>

    {selectMode && selected.size > 0 ? <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-4xl px-4 sm:bottom-4">
      <div className="rounded-2xl bg-[#11223a] p-4 text-white shadow-2xl">
        {confirming ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{confirming === "excluir" ? `Excluir ${selected.size} ${selected.size === 1 ? "escala" : "escalas"}? Essa ação não pode ser desfeita.` : `Replicar ${selected.size} ${selected.size === 1 ? "escala" : "escalas"} para o mês seguinte?`}</p>
          <div className="flex shrink-0 gap-2">
            <button className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold" onClick={() => setConfirming(null)} type="button">Cancelar</button>
            <form action={confirming === "excluir" ? deleteSchedulesBatch : replicateSchedulesToNextMonth}>
              {Array.from(selected).map((id) => <input key={id} name="scheduleIds" type="hidden" value={id} />)}
              <button className={`rounded-lg px-3 py-2 text-sm font-bold ${confirming === "excluir" ? "bg-red-600" : "bg-emerald-600"}`} type="submit">Confirmar</button>
            </form>
          </div>
        </div> : <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">{selected.size} {selected.size === 1 ? "selecionada" : "selecionadas"}</span>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold" onClick={() => setConfirming("replicar")} type="button"><CalendarClock size={16} />Replicar p/ próximo mês</button>
            <button className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold" onClick={() => setConfirming("excluir")} type="button"><Trash2 size={16} />Excluir</button>
            <button aria-label="Cancelar seleção" className="rounded-lg bg-white/15 p-2" onClick={exitSelectMode} type="button"><X size={16} /></button>
          </div>
        </div>}
      </div>
    </div> : null}
  </div>;
}
