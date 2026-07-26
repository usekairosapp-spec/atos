import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus, Check, ExternalLink } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { addAssignmentToGoogleCalendar } from "@/features/calendar/actions";
import { formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { params: Promise<{ scheduleId: string; assignmentId: string }> };

export default async function ConfirmedPage({ params }: PageProps) {
  const [{ scheduleId, assignmentId }, viewer] = await Promise.all([params, getViewerContext()]);
  if (!viewer) redirect("/entrar");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_confirmation_page_data", { target_schedule_id: scheduleId, target_assignment_id: assignmentId });
  const confirmation = data?.[0];
  if (!confirmation) notFound();
  const { data: calendarEvent } = await supabase.from("google_calendar_events").select("html_link").eq("assignment_id", assignmentId).maybeSingle();
  const date = new Date(confirmation.service_starts_at);
  const tz = viewer.profile.timezone;
  return <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-[#11313d] p-4"><section className="flex min-h-[75vh] w-full max-w-xl flex-col items-center rounded-[2.5rem] bg-emerald-600 px-7 py-12 text-center text-white shadow-2xl"><span className="mt-8 grid h-36 w-36 place-items-center rounded-full bg-white text-emerald-600 shadow-xl"><Check size={76} strokeWidth={3} /></span><h1 className="mt-10 text-3xl font-bold">Presença confirmada!</h1><div className="mt-12 text-xl leading-relaxed"><p className="font-semibold">{confirmation.service_title}</p><p>{formatDate(date, tz)} · {formatTime(date, tz, { hour: "2-digit", minute: "2-digit" })}</p><p>{confirmation.department_name} — {confirmation.position_name}</p></div><p className="mt-10 text-lg">Deus abençoe seu ministério!</p>{calendarEvent?.html_link ? <a className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 font-bold text-emerald-700" href={calendarEvent.html_link} rel="noreferrer" target="_blank">Abrir no Google Agenda <ExternalLink size={18} /></a> : null}<form action={addAssignmentToGoogleCalendar} className="mt-4 w-full"><input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="scheduleId" value={scheduleId} /><button className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 font-bold text-[#202e3c]"><CalendarPlus size={20} />{calendarEvent ? "Sincronizar ou recriar evento" : "Adicionar ao Google Agenda"}</button></form><Link className="mt-4 min-h-14 w-full rounded-2xl border border-white/70 px-5 py-4 font-bold text-white" href="/painel">Voltar para o início</Link></section></main>;
}
