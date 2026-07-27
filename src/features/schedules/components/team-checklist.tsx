"use client";

import { useTransition } from "react";
import { addScheduleAssignment, removeScheduleAssignment } from "../actions";

type Position = { id: string; name: string };
type Member = { userId: string; name: string };
type ExistingAssignment = { id: string; userId: string; positionName: string };

export function TeamChecklist({ scheduleId, positions, members, assignments, voltarLote }: {
  scheduleId: string;
  positions: Position[];
  members: Member[];
  assignments: ExistingAssignment[];
  voltarLote?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle(position: Position, member: Member) {
    const existing = assignments.find((item) => item.userId === member.userId && item.positionName === position.name);
    const formData = new FormData();
    formData.set("scheduleId", scheduleId);
    if (voltarLote) formData.set("voltarLote", voltarLote);
    if (existing) {
      formData.set("assignmentId", existing.id);
      startTransition(async () => { await removeScheduleAssignment(formData); });
    } else {
      formData.set("positionId", position.id);
      formData.set("userId", member.userId);
      startTransition(async () => { await addScheduleAssignment(formData); });
    }
  }

  if (!positions.length) return <p className="mt-4 text-sm text-amber-700">Cadastre uma função no setor antes de montar a escala.</p>;

  return <div className="mt-5 grid gap-4 md:grid-cols-2">
    {positions.map((position) => <fieldset className="rounded-2xl border border-[#e1e7ef] p-4" key={position.id}>
      <legend className="px-2 font-bold text-[var(--church-brand)]">{position.name}</legend>
      <div className="mt-2 space-y-2">
        {members.map((member) => {
          const isAssigned = assignments.some((item) => item.userId === member.userId && item.positionName === position.name);
          return <label className={`flex min-h-11 items-center gap-3 rounded-xl px-3 ${isAssigned ? "bg-emerald-50 text-emerald-800" : "bg-[#f6f8fb] text-gray-900 dark:bg-[#273136] dark:text-white"}`} key={member.userId}>
            <input checked={isAssigned} className="h-5 w-5 accent-[var(--church-brand)]" disabled={isPending} onChange={() => toggle(position, member)} type="checkbox" />
            <span>{member.name}{isAssigned ? " — já escalado(a)" : ""}</span>
          </label>;
        })}
      </div>
    </fieldset>)}
  </div>;
}
