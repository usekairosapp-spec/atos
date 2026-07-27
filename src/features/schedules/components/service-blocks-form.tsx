"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Position = { id: string; name: string };
type Member = { userId: string; name: string };
type InitialBlock = { title: string; startTime: string; endTime: string; location: string; notes: string; selected: string[] };

type Block = {
  key: number;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  selected: Set<string>;
};

let nextBlockKey = 1;

function makeBlock(initial?: InitialBlock): Block {
  return {
    key: nextBlockKey++,
    title: initial?.title ?? "",
    startTime: initial?.startTime ?? "",
    endTime: initial?.endTime ?? "",
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
    selected: new Set(initial?.selected ?? []),
  };
}

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] bg-white px-4 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]";

export function ServiceBlocksForm({ positions, members, initialBlock }: { positions: Position[]; members: Member[]; initialBlock?: InitialBlock }) {
  const [blocks, setBlocks] = useState<Block[]>(() => [makeBlock(initialBlock)]);

  function updateBlock(key: number, patch: Partial<Omit<Block, "key" | "selected">>) {
    setBlocks((prev) => prev.map((block) => (block.key === key ? { ...block, ...patch } : block)));
  }

  function toggleAssignment(key: number, assignmentKey: string) {
    setBlocks((prev) => prev.map((block) => {
      if (block.key !== key) return block;
      const next = new Set(block.selected);
      if (next.has(assignmentKey)) next.delete(assignmentKey);
      else next.add(assignmentKey);
      return { ...block, selected: next };
    }));
  }

  return (
    <div className="grid gap-6">
      <input name="serviceCount" type="hidden" value={blocks.length} />
      {blocks.map((block, index) => (
        <section className="rounded-[1.75rem] bg-white p-6 shadow-sm" key={block.key}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{index === 0 ? "2. Dados do culto" : `Culto ${index + 1} (mesmo dia)`}</h2>
            {blocks.length > 1 ? <button className="flex items-center gap-1 text-sm font-semibold text-red-700" onClick={() => setBlocks((prev) => prev.filter((b) => b.key !== block.key))} type="button"><Trash2 size={15} />Remover</button> : null}
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="font-semibold sm:col-span-2">Nome do evento<input className={inputClass} name={`title-${index}`} onChange={(event) => updateBlock(block.key, { title: event.target.value })} placeholder={index === 0 ? "Ex.: Culto de domingo" : "Ex.: Culto da noite"} required value={block.title} /></label>
            <label className="font-semibold">Horário de início<input className={inputClass} name={`startTime-${index}`} onChange={(event) => updateBlock(block.key, { startTime: event.target.value })} required type="time" value={block.startTime} /></label>
            <label className="font-semibold">Horário de término<input className={inputClass} name={`endTime-${index}`} onChange={(event) => updateBlock(block.key, { endTime: event.target.value })} required type="time" value={block.endTime} /></label>
            <label className="font-semibold sm:col-span-2">Local<input className={inputClass} name={`location-${index}`} onChange={(event) => updateBlock(block.key, { location: event.target.value })} placeholder="Ex.: Templo principal" value={block.location} /></label>
            <label className="font-semibold sm:col-span-2">Observações<textarea className={`${inputClass} min-h-24 py-3`} name={`notes-${index}`} onChange={(event) => updateBlock(block.key, { notes: event.target.value })} placeholder="Orientações para a equipe" value={block.notes} /></label>
          </div>

          <h3 className="mt-6 font-bold">Equipe {blocks.length > 1 ? `deste culto` : "(aplicada a todos os dias marcados)"}</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {positions.map((position) => <fieldset className="rounded-2xl border border-[#e1e7ef] p-4" key={position.id}>
              <legend className="px-2 font-bold text-[var(--church-brand)]">{position.name}</legend>
              <div className="mt-2 space-y-2">
                {members.map((member) => {
                  const assignmentKey = `${position.id}|${member.userId}`;
                  return <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#f6f8fb] px-3 text-gray-900 dark:bg-[#273136] dark:text-white" key={member.userId}>
                    <input checked={block.selected.has(assignmentKey)} className="h-5 w-5 accent-[var(--church-brand)]" name={`selection-${index}`} onChange={() => toggleAssignment(block.key, assignmentKey)} type="checkbox" value={assignmentKey} />
                    <span>{member.name}</span>
                  </label>;
                })}
              </div>
            </fieldset>)}
          </div>
          {!positions.length ? <p className="mt-2 text-sm text-amber-700">Cadastre uma função no setor antes de montar a escala.</p> : null}
        </section>
      ))}

      {blocks.length < 5 ? <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--church-brand)] px-5 font-semibold text-[var(--church-brand)]" onClick={() => setBlocks((prev) => [...prev, makeBlock()])} type="button"><Plus size={18} />Tem mais de um culto neste dia? Adicionar outro</button> : null}
    </div>
  );
}
