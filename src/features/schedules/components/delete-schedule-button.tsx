"use client";

import { Trash2 } from "lucide-react";
import { deleteSchedule } from "@/features/schedules/actions";

export function DeleteScheduleButton({ scheduleId }: { scheduleId: string }) {
  return <form action={deleteSchedule} className="mt-4" onSubmit={(event) => { if (!window.confirm("Excluir esta escala permanentemente? Todas as confirmações e trocas relacionadas também serão removidas.")) event.preventDefault(); }}><input type="hidden" name="scheduleId" value={scheduleId} /><button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-5 font-semibold text-red-700"><Trash2 size={18} />Excluir escala</button></form>;
}
