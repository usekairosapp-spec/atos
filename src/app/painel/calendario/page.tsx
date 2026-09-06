import Link from "next/link";
import { CalendarDayDialog } from "@/features/calendar/components/calendar-day-dialog";
import { CalendarCheck2, CalendarPlus, ChevronLeft, ChevronRight, Clock3, ExternalLink, MapPin } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { addAssignmentToGoogleCalendar } from "@/features/calendar/actions";
import { createClient } from "@/lib/supabase/server";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { DEFAULT_TIMEZONE, formatDate, formatTime } from "@/shared/lib/timezone";

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

function localDateKey(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
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
  const tz = viewer?.profile.timezone ?? DEFAULT_TIMEZONE;
  const today = new Date();
  const match = query.mes?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : Number(localDateKey(today, tz).slice(0, 4));
  const month = match ? Number(match[2]) - 1 : Number(localDateKey(today, tz).slice(5, 7)) - 1;
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
  const { data: sectorData, error: sectorError } = viewer?.currentChurch
    ? await supabase.rpc("get_department_calendar_month", { target_church_id: viewer.currentChurch.id, target_month: `${currentMonth}-01` })
    : { data: [], error: null };
  const visibleAssignments = [...new Map([...(sectorData ?? []) as CalendarAssignment[], ...normalizedData as CalendarAssignment[]].map((item) => [item.assignment_id, item])).values()];
  const groupedAssignments = new Map<string, CalendarEntry>();
  for (const assignment of visibleAssignments) {
    const existing = groupedAssignments.get(assignment.schedule_id);
    if (!existing) {
      groupedAssignments.set(assignment.schedule_id, { ...assignment, assignment_ids: [assignment.assignment_id] });
      continue;
    }
    const isOwn = assignment.owner_user_id === viewer?.user.id;
    const existingIsOwn = existing.owner_user_id === viewer?.user.id;
    const useCurrent = (isOwn && !existingIsOwn) || (isOwn === existingIsOwn && assignment.assignment_status === "confirmed" && existing.assignment_status !== "confirmed");
    groupedAssignments.set(assignment.schedule_id, {
      ...(useCurrent ? assignment : existing),
      assignment_ids: [...existing.assignment_ids, assignment.assignment_id],
    });
  }
  const assignments = [...groupedAssignments.values()];
  const monthAssignments = assignments.filter((assignment) => localDateKey(assignment.service_starts_at, tz).startsWith(`${currentMonth}-`));
  const assignmentsByDay = new Map<string, CalendarEntry[]>();
  for (const assignment of monthAssignments) {
    const key = localDateKey(assignment.service_starts_at, tz);
    assignmentsByDay.set(key, [...(assignmentsByDay.get(key) ?? []), assignment]);
  }
  const requestedDay = query.dia && Array.from({ length: last.getDate() }, (_, index) => `${currentMonth}-${String(index + 1).padStart(2, "0")}`).includes(query.dia) ? query.dia : null;
  const todayKey = localDateKey(today, tz);
  const selectedDay = requestedDay;
  const selectedAssignments = selectedDay ? assignmentsByDay.get(selectedDay) ?? [] : [];
  const teamResults = await Promise.all(selectedAssignments.map(async (assignment) => {
    const { data: team, error: teamError } = await supabase.rpc("get_schedule_team", { target_schedule_id: assignment.schedule_id });
    const members = new Map<string, { name: string; positions: string[] }>();
    for (const member of (team ?? []) as { user_id: string; member_name: string; position_name: string; assignment_status: string }[]) {
      if (!["pending", "confirmed", "replacement_requested"].includes(member.assignment_status)) continue;
      const existing = members.get(member.user_id);
      if (existing) {
        if (!existing.positions.includes(member.position_name)) existing.positions.push(member.position_name);
      } else members.set(member.user_id, { name: member.member_name, positions: [member.position_name] });
    }
    return [assignment.schedule_id, { error: Boolean(teamError), members: [...members.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name, "pt-BR")) }] as const;
  }));
  const teams = new Map(teamResults);
  const cells: Array<number | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: last.getDate() }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);

  return <main className="mx-auto max-w-4xl px-4 py-7 sm:px-8">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Agenda dos meus setores</p><h1 className="mt-1 text-3xl font-bold">Calendário</h1></div><span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-2 text-sm font-semibold text-[var(--church-brand)]">{monthAssignments.length} {monthAssignments.length === 1 ? "escala" : "escalas"}</span></div>
    {sectorError ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Não foi possível carregar as escalas dos seus setores. Tente novamente.</p> : null}
    {query.erro ? <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{query.erro}</p> : null}
    {query.sucesso ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-700">{query.sucesso}</p> : null}
    <section className="mt-7 rounded-[2rem] bg-white p-4 shadow-sm sm:p-7">
      <div className="flex items-center justify-between"><Link aria-label="Mês anterior" className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--church-brand-softer)]" href={`/painel/calendario?mes=${previous}`}><ChevronLeft /></Link><h2 className="text-lg font-bold capitalize">{formatDate(first, tz, { month: "long", year: "numeric" })}</h2><Link aria-label="Próximo mês" className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--church-brand-softer)]" href={`/painel/calendario?mes=${next}`}><ChevronRight /></Link></div>
      <div className="mt-6 grid grid-cols-7 text-center text-xs font-semibold uppercase text-[#717880]">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span className="py-2" key={day}>{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-2 text-center">{cells.map((day, index) => {
        if (!day) return <span className="min-h-12" key={`empty-${index}`} />;
        const dateKey = `${currentMonth}-${String(day).padStart(2, "0")}`;
        const count = assignmentsByDay.get(dateKey)?.length ?? 0;
        const selected = dateKey === selectedDay;
        const accessibleDate = formatDate(new Date(`${dateKey}T12:00:00Z`), tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        const countLabel = count === 1 ? "1 escala" : `${count} escalas`;
        return <Link scroll={false} aria-haspopup="dialog" aria-current={selected ? "date" : undefined} aria-label={`${accessibleDate}, ${countLabel}${dateKey === todayKey ? ", hoje" : ""}`} className="grid min-h-12 place-items-center" href={`/painel/calendario?mes=${currentMonth}&dia=${dateKey}`} key={dateKey}><span className={`relative grid h-11 w-11 place-items-center rounded-full font-semibold transition ${selected ? "bg-[var(--church-brand-dark)] text-white shadow-md" : count ? "bg-[var(--church-brand-soft)] text-[var(--church-brand)]" : dateKey === todayKey ? "bg-emerald-100 text-emerald-800" : "hover:bg-[#f1f4f8] dark:hover:bg-[#273136]"} ${dateKey === todayKey && !selected ? "ring-2 ring-emerald-500 ring-offset-2" : ""}`}>{day}{count > 1 ? <small aria-hidden="true" className={`absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${selected ? "bg-white text-[var(--church-brand-dark)]" : "bg-[var(--church-brand)] text-white"}`}>{count}</small> : null}</span></Link>;
      })}</div>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#6b767d]"><i className="h-3 w-3 rounded-full bg-[var(--church-brand-light)]" />Tem escala</div>
    </section>

    {selectedDay ? <CalendarDayDialog key={selectedDay} title={formatDate(new Date(`${selectedDay}T12:00:00Z`), tz, { weekday: "long", day: "2-digit", month: "long" })} closeHref={`/painel/calendario?mes=${currentMonth}`}>
    <section>
      <div className="mt-4 space-y-4">{selectedAssignments.map((assignment) => {
        const start = new Date(assignment.service_starts_at);
        const end = new Date(assignment.service_ends_at);
        const googleLink = assignment.google_html_link;
        const team = teams.get(assignment.schedule_id);
        const isOwn = assignment.owner_user_id === viewer?.user.id;
        const status = assignment.assignment_status === "confirmed" ? "Confirmado" : assignment.assignment_status === "replacement_requested" ? "Troca solicitada" : "Pendente";
        const returnTo = `/painel/calendario?mes=${currentMonth}&dia=${selectedDay}`;
        return <article className="rounded-[1.75rem] bg-white p-5 shadow-sm" key={assignment.assignment_id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[var(--church-brand)]">{assignment.department_name}</p><h3 className="mt-1 text-xl font-bold">{assignment.service_title}</h3>{isOwn ? <p className="mt-1 text-[#50585f]">Sua função: {assignment.position_name}</p> : null}</div>{isOwn ? <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Confirmado" ? "bg-emerald-100 text-emerald-700" : status === "Troca solicitada" ? "bg-amber-100 text-amber-700" : "bg-[var(--church-brand-soft)] text-[var(--church-brand-on-soft)]"}`}>{status}</span> : null}</div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#6b767d]"><span className="flex items-center gap-2"><Clock3 size={16} />{formatTime(start, tz, { hour: "2-digit", minute: "2-digit" })}–{formatTime(end, tz, { hour: "2-digit", minute: "2-digit" })}</span>{assignment.service_location ? <span className="flex items-center gap-2"><MapPin size={16} />{assignment.service_location}</span> : null}</div>
          <section className="mt-5 border-t border-[#e2e7ee] pt-4" aria-label={`Equipe de ${assignment.department_name}`}>
            <h4 className="font-bold">Pessoas escaladas</h4>
            {team?.error ? <p role="alert" className="mt-3 text-sm text-red-700">Não foi possível carregar a equipe. Feche e toque no dia para tentar novamente.</p> : team?.members.length ? <ul className="mt-2 divide-y divide-[#e2e7ee]">{team.members.map(([userId, member]) => <li className="flex items-center gap-3 py-3" key={userId}><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--church-brand-soft)] font-bold text-[var(--church-brand)]">{member.name.charAt(0).toLocaleUpperCase("pt-BR")}</span><div className="min-w-0"><p className="break-words font-semibold">{member.name}</p><p className="text-sm text-[#6b767d]">{member.positions.join(" · ")}</p></div></li>)}</ul> : <p className="mt-3 text-sm text-[#6b767d]">Nenhuma pessoa escalada.</p>}
          </section>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{isOwn ? <Link className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--church-brand)] font-semibold text-[var(--church-brand)]" href={`/painel/escalas/${assignment.schedule_id}?visao=minhas`}>Ver escala completa</Link> : null}{isOwn ? assignment.assignment_status === "confirmed" ? googleLink ? <div className="grid grid-cols-2 gap-2"><a className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-emerald-300 text-sm font-semibold text-emerald-700" href={googleLink} rel="noreferrer" target="_blank">Abrir <ExternalLink size={15} /></a><form action={addAssignmentToGoogleCalendar}><input name="assignmentId" type="hidden" value={assignment.assignment_id} /><input name="scheduleId" type="hidden" value={assignment.schedule_id} /><input name="returnTo" type="hidden" value={returnTo} /><PendingSubmitButton className="flex min-h-12 w-full items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 text-sm font-semibold text-white" pendingLabel="Sincronizando...">Sincronizar</PendingSubmitButton></form></div> : <form action={addAssignmentToGoogleCalendar}><input name="assignmentId" type="hidden" value={assignment.assignment_id} /><input name="scheduleId" type="hidden" value={assignment.schedule_id} /><input name="returnTo" type="hidden" value={returnTo} /><PendingSubmitButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white" pendingLabel="Adicionando..."><CalendarPlus size={18} />Adicionar ao Google</PendingSubmitButton></form> : <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f1f4f8] text-sm font-semibold text-[#6b767d] dark:bg-[#273136] dark:text-[#9aa5b1]"><CalendarCheck2 size={18} />Confirme para sincronizar</span> : null}</div>
        </article>;
      })}</div>
      {!selectedAssignments.length ? <p className="py-10 text-center text-[#6b767d]">Nenhuma escala para este dia.</p> : null}
    </section>
    </CalendarDayDialog> : <p className="mt-7 text-center text-[#6b767d]">Toque em um dia para ver quem está escalado.</p>}
  </main>;
}
