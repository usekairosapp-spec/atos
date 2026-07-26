"use client";

import { useState } from "react";
import { confirmAssignment } from "@/features/schedules/actions";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

type Props = {
  assignmentId: string;
  scheduleId: string;
  serviceDate: string;
  startTime: string;
  endTime: string;
};

export function ConfirmAssignmentForm({ assignmentId, scheduleId, serviceDate, startTime, endTime }: Props) {
  const [availability, setAvailability] = useState<"full" | "partial">("full");

  return <form action={confirmAssignment} className="grid gap-3">
    <input type="hidden" name="assignmentId" value={assignmentId} />
    <input type="hidden" name="scheduleId" value={scheduleId} />
    <input type="hidden" name="serviceDate" value={serviceDate} />

    <fieldset className="grid gap-2">
      <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${availability === "full" ? "border-[var(--church-brand)] bg-[var(--church-brand-soft)]" : "border-[#d7dee7]"}`}>
        <input checked={availability === "full"} className="h-4 w-4 accent-[var(--church-brand)]" name="availability" onChange={() => setAvailability("full")} type="radio" value="full" />
        Posso ficar o horário todo ({startTime} às {endTime})
      </label>
      <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${availability === "partial" ? "border-[var(--church-brand)] bg-[var(--church-brand-soft)]" : "border-[#d7dee7]"}`}>
        <input checked={availability === "partial"} className="h-4 w-4 accent-[var(--church-brand)]" name="availability" onChange={() => setAvailability("partial")} type="radio" value="partial" />
        Só posso ficar até um horário específico
      </label>
    </fieldset>

    {availability === "partial" ? <label className="font-semibold">Até que horas você consegue ficar?
      <input className="mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] px-4" defaultValue={startTime} max={endTime} min={startTime} name="availableUntilTime" required type="time" />
    </label> : null}

    <PendingSubmitButton className="min-h-14 w-full rounded-2xl bg-emerald-600 px-5 font-bold text-white" pendingLabel="Confirmando...">Confirmar presença</PendingSubmitButton>
  </form>;
}
