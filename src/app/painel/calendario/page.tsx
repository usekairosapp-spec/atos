import Link from "next/link";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, Clock3, ExternalLink, MapPin } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { addAssignmentToGoogleCalendar } from "@/features/calendar/actions";
import { createClient } from "@/lib/supabase/server";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

type PageProps = { searchParams: Promise<{ mes?: string; dia?: string; erro?: string; sucesso?: string }> };
type CalendarAssignment = {
  assignment_id: string;
  owner_user_id: string;
  assignment_status: string;
  schedule_id: string;
  service_title: string;
  service_starts_at: string;
  service_ends_at: string;
  service_location: string | null;
  department_name: string;
  position_name: string;
  google_html_link: string | null;
};
type CalendarEntry = CalendarAssignment & { assignment_ids: string[] };

const TIME_ZONE = "America/Sao_Paulo";

function localDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthKey(year: number, month: number) {
  const normalized = new Date(year, month, 1);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const viewer = await getViewerContext();
  const today = new Date();
  const match = query.mes?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : Number(localDateKey(today).slice(0, 4));
  const month = match ? Number(match[2]) - 1 : Number(localDateKey(today).slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, month, 1, 12));
  const last = new Date(Date.UTC(year, month + 1, 0, 12));
  const currentMonth = monthKey(year, month);
  const previous = monthKey(year, month - 1);
  const next = monthKey(year, month + 1);
  const supabase = await createClient();
  const { data, error } = viewer?.currentChurch
    ? await supabase.rpc("get_personal_calendar_month", { target_church_id: viewer.currentChurch.id, target_month: `${currentMonth}-01` })
    : { data: [], error: null };
  const { data: fallbackData } = error && viewer?.currentChurch
    ? await supabase.rpc("get_my_calendar_assignments", { target_church_id: viewer.currentChurch.id })
    : { data: null };
  const normalizedData = data ?? (fallbackData ?? []).map((item: Omit<CalendarAssignment, "owner_user_id">) => ({ ...item, owner_user_id: viewer?.user.id ?? "" }));
  const personalAssignments = (normalizedData as CalendarAssignment[]).filter((item) => item.owner_user_id === viewer?.user.id);
  const groupedAssignments = new Map<string, CalendarEntry>();
  for (const assignment of personalAssignments) {
    const existing = groupedAssignments.get(assignment.schedule_id);
    if (!existing) {
      groupedAssignments.set(assignment.schedule_id, { ...assignment, assignment_ids: [assignment.assignment_id] });
      continue;
    }
    const useCurrent = assignment.assignment_status === "confirmed" && existing.assignment_status !== "confirmed";
    groupedAssignments.set(assignment.schedule_id, {
      ...(useCurrent ? assignment : existing),
      assignment_ids: [...existing.assignment_ids, assignment.assignment_id],
    });
  }
  const assignments = [...groupedAssignments.values()];
  const monthAssignments = assignments.filter((assignment) => localDateKey(assignment.service_starts_at).startsWith(`${currentMonth}-`));
  const assignmentsByDay = new Map<string, CalendarEntry[]>();
  for (const assignment of monthAssignments) {
    const key = localDateKey(assignment.service_starts_at);
    assignmentsByDay.set(key, [...(assignmentsByDay.get(key) ?? []), assignment]);
  }
  const requestedDay = query.dia && assignmentsByDay.has(query.dia) ? query.dia : null;
  const todayKey = localDateKey(today);
  const selectedDay = requestedDay;
  const selectedAssignments = selectedDay ? assignmentsByDay.get(selectedDay) ?? [] : [];
  const cells: Array<number | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);

  return <main className="mx-auto max-w-4xl px-4 py-7 sm:px-8">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.15em] text-[#6827d8]">Minha agenda</p><h1 className="mt-1 text-3xl font-bold">Calendário</h1></div><span className="rounded-full bg-violet-100 px-3 py-2 text-sm font-semibold text-[#6827d8]">{monthAssignments.length} {monthAssignments.length === 1 ? "escala" : "escalas"}</span></div>
    {query.erro ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</p> : null}
    {query.sucesso ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-700">{query.sucesso}</p> : null}
    <section className="mt-7 rounded-[2rem] bg-white p-4 shadow-sm sm:p-7">
      <div className="flex items-center justify-between"><Link aria-label="Mês anterior" className="grid h-11 w-11 place-items-center rounded-full hover:bg-violet-50" href={`/painel/calendario?mes=${previous}`}><ChevronLeft /></Link><h2 className="text-lg font-bold capitalize">{first.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: TIME_ZONE })}</h2><Link aria-label="Próximo mês" className="grid h-11 w-11 place-items-center rounded-full hover:bg-violet-50" href={`/painel/calendario?mes=${next}`}><ChevronRight /></Link></div>
      <div className="mt-6 grid grid-cols-7 text-center text-xs font-semibold uppercase text-[#777180]">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span className="py-2" key={day}>{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-2 text-center">{cells.map((day, index) => {
        if (!day) return <span className="min-h-12" key={`empty-${index}`} />;
        const dateKey = `${currentMonth}-${String(day).padStart(2, "0")}`;
        const count = assignmentsByDay.get(dateKey)?.length ?? 0;
        const selected = dateKey === selectedDay;
        const accessibleDate = new Date(`${dateKey}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
        const countLabel = count === 1 ? "1 escala" : `${count} escalas`;
        return <Link aria-current={selected ? "date" : undefined} aria-label={`${accessibleDate}, ${countLabel}${dateKey === todayKey ? ", hoje" : ""}`} className="grid min-h-12 place-items-center" href={`/painel/calendario?mes=${currentMonth}&dia=${dateKey}`} key={dateKey}><span className={`relative grid h-11 w-11 place-items-center rounded-full font-semibold transition ${selected ? "bg-[#21164d] text-white shadow-md" : count ? "bg-violet-100 text-[#6827d8]" : dateKey === todayKey ? "bg-emerald-100 text-emerald-800" : "hover:bg-[#f4f1f8]"} ${dateKey === todayKey && !selected ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}>{day}{count > 1 ? <small aria-hidden="true" className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${selected ? "bg-white text-[#21164d]" : "bg-[#6827d8] text-white"}`}>{count}</small> : null}</span></Link>;
      })}</div>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#6f6b7d]"><i className="h-3 w-3 rounded-full bg-violet-200" />Tem escala</div>
    </section>

    <section className="mt-7">
      <h2 className="text-xl font-bold">{selectedDay ? new Date(`${selectedDay}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TIME_ZONE }) : "Agenda do mês"}</h2>
      <div className="mt-4 space-y-4">{selectedAssignments.map((assignment) => {
        const start = new Date(assignment.service_starts_at);
        const end = new Date(assignment.service_ends_at);
        const googleLink = assignment.google_html_link;
        const status = assignment.assignment_status === "confirmed" ? "Confirmado" : assignment.assignment_status === "replacement_requested" ? "Troca solicitada" : "Pendente";
        const returnTo = `/painel/calendario?mes=${currentMonth}&dia=${selectedDay}`;
        return <article className="rounded-[1.75rem] bg-white p-5 shadow-sm" key={assignment.assignment_id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#6827d8]">{assignment.department_name}</p><h3 className="mt-1 text-xl font-bold">{assignment.service_title}</h3><p className="mt-1 text-[#55505f]">{assignment.position_name}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Confirmado" ? "bg-emerald-100 text-emerald-700" : status === "Troca solicitada" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{status}</span></div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#6f6b7d]"><span className="flex items-center gap-2"><Clock3 size={16} />{start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE })}–{end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE })}</span>{assignment.service_location ? <span className="flex items-center gap-2"><MapPin size={16} />{assignment.service_location}</span> : null}</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link className="flex min-h-12 items-center justify-center rounded-xl border border-[#6827d8] font-semibold text-[#6827d8]" href={`/painel/escalas/${assignment.schedule_id}?visao=minhas`}>Ver escala completa</Link>{assignment.assignment_status === "confirmed" ? googleLink ? <div className="grid grid-cols-2 gap-2"><a className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-emerald-300 text-sm font-semibold text-emerald-700" href={googleLink} rel="noreferrer" target="_blank">Abrir <ExternalLink size={15} /></a><form action={addAssignmentToGoogleCalendar}><input name="assignmentId" type="hidden" value={assignment.assignment_id} /><input name="scheduleId" type="hidden" value={assignment.schedule_id} /><input name="returnTo" type="hidden" value={returnTo} /><PendingSubmitButton className="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 text-sm font-semibold text-white" pendingLabel="Sincronizando...">Sincronizar</PendingSubmitButton></form></div> : <form action={addAssignmentToGoogleCalendar}><input name="assignmentId" type="hidden" value={assignment.assignment_id} /><input name="scheduleId" type="hidden" value={assignment.schedule_id} /><input name="returnTo" type="hidden" value={returnTo} /><PendingSubmitButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white" pendingLabel="Adicionando..."><CalendarPlus size={18} />Adicionar ao Google</PendingSubmitButton></form> : <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f4f1f8] text-sm font-semibold text-[#6f6b7d]"><CalendarCheck2 size={18} />Confirme para sincronizar</span>}</div>
        </article>;
      })}</div>
      {!selectedAssignments.length ? <div className="mt-4 rounded-[1.75rem] border border-dashed border-[#cec6dc] bg-white p-8 text-center"><CalendarCheck2 className="mx-auto text-[#6827d8]" size={36} /><p className="mt-3 font-semibold">{monthAssignments.length ? "Selecione um dia com escala." : "Nenhuma escala neste mês."}</p><p className="mt-1 text-sm text-[#6f6b7d]">{monthAssignments.length ? "Os detalhes aparecerão aqui." : "Quando você for escalado, o compromisso aparecerá aqui."}</p></div> : null}
    </section>
  </main>;
}
