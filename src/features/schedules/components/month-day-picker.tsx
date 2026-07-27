"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function MonthDayPicker({ initialYear, initialMonth }: { initialYear: number; initialMonth: number }) {
  const [cursor, setCursor] = useState({ year: initialYear, month: initialMonth });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const leading = first.getDay();
    const list: Array<number | null> = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (list.length % 7) list.push(null);
    return list;
  }, [cursor]);

  function toggle(day: number) {
    const iso = isoDate(cursor.year, cursor.month, day);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const sortedSelected = [...selected].sort();

  return (
    <div>
      {sortedSelected.map((iso) => <input key={iso} name="dates" type="hidden" value={iso} />)}
      <div className="flex items-center justify-between">
        <button aria-label="Mês anterior" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--church-brand-soft)]" onClick={() => setCursor((c) => { const d = new Date(c.year, c.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} type="button"><ChevronLeft size={18} /></button>
        <strong className="capitalize">{monthLabel}</strong>
        <button aria-label="Próximo mês" className="grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--church-brand-soft)]" onClick={() => setCursor((c) => { const d = new Date(c.year, c.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })} type="button"><ChevronRight size={18} /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold uppercase text-[#717880]">
        {WEEKDAYS.map((day) => <span className="py-1" key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span className="min-h-11" key={`empty-${index}`} />;
          const iso = isoDate(cursor.year, cursor.month, day);
          const isSelected = selected.has(iso);
          return (
            <button
              className={`grid min-h-11 place-items-center rounded-full text-sm font-semibold transition ${isSelected ? "bg-[var(--church-brand)] text-white" : "hover:bg-[var(--church-brand-soft)]"}`}
              key={iso}
              onClick={() => toggle(day)}
              type="button"
            >
              {day}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--church-brand)]">{selected.size === 0 ? "Nenhum dia selecionado" : `${selected.size} ${selected.size === 1 ? "dia selecionado" : "dias selecionados"}`}</p>
    </div>
  );
}
