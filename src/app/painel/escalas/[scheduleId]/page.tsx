import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarPlus, CheckCircle2, Clock3, ExternalLink, MapPin, Users } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { cancelAssignmentSwap, publishSchedule, respondToPeerSwap, updateSchedule } from "@/features/schedules/actions";
import { ConfirmAssignmentForm } from "@/features/schedules/components/confirm-assignment-form";
import { DeleteScheduleButton } from "@/features/schedules/components/delete-schedule-button";
import { TeamChecklist } from "@/features/schedules/components/team-checklist";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { addAssignmentToGoogleCalendar } from "@/features/calendar/actions";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { params: Promise<{ scheduleId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string; visao?: string; voltarLote?: string }> };
type TeamAssignment = {
  id: string;
  user_id: string;
  status: string;
  available_until: string | null;
  positions: { name: string } | { name: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
};
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function ScheduleDetailPage({ params, searchParams }: PageProps) {
  const [{ scheduleId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer) notFound();
  const supabase = await createClient();
  const { data: schedule } = await supabase.from("department_schedules")
    .select("id, department_id, status, departments(name, church_id), services(title, starts_at, ends_at, location, notes)")
    .eq("id", scheduleId).maybeSingle();
  if (!schedule) notFound();
  const service = Array.isArray(schedule.services) ? schedule.services[0] : schedule.services;
  const department = Array.isArray(schedule.departments) ? schedule.departments[0] : schedule.departments;
  if (!service || !department) notFound();
  const canManage = message.visao !== "minhas"
    && department.church_id === viewer.currentChurch?.id
    && (viewer.isChurchAdmin || viewer.departmentMemberships.some((item) => item.department_id === schedule.department_id && item.role === "leader"));

  const [{ data: positions }, { data: members }, { data: assignmentRows }, { data: swapRequests }, { data: ownAssignmentRows }, { data: receivedSwapRequests }, { data: ownSwapRequestRows }] = await Promise.all([
    canManage ? supabase.from("positions").select("id, name").eq("department_id", schedule.department_id).eq("active", true).order("name") : Promise.resolve({ data: [] }),
    canManage
      ? supabase.from("church_memberships").select("user_id, profiles!church_memberships_user_id_fkey(full_name)").eq("church_id", department.church_id).eq("status", "active")
      : supabase.from("department_memberships").select("user_id, profiles!department_memberships_user_id_fkey(full_name)").eq("department_id", schedule.department_id).eq("status", "active"),
    supabase.rpc("get_schedule_team", { target_schedule_id: scheduleId }),
    canManage ? supabase.from("swap_requests").select("id, reason, suggested_user_id, profiles!swap_requests_requested_by_fkey(full_name), suggested:profiles!swap_requests_suggested_user_id_fkey(full_name), schedule_assignments!inner(department_schedule_id)").eq("status", "pending").eq("schedule_assignments.department_schedule_id", scheduleId) : Promise.resolve({ data: [] }),
    supabase.rpc("get_my_schedule_assignment", { target_schedule_id: scheduleId }),
    supabase.from("swap_requests").select("id, reason, profiles!swap_requests_requested_by_fkey(full_name), schedule_assignments!inner(department_schedule_id)").eq("status", "pending").eq("suggested_user_id", viewer.user.id).eq("schedule_assignments.department_schedule_id", scheduleId),
    supabase.from("swap_requests").select("id, schedule_assignments!inner(department_schedule_id)").eq("status", "pending").eq("requested_by", viewer.user.id).eq("schedule_assignments.department_schedule_id", scheduleId),
  ]);
  const ownSwapRequestId: string | null = ownSwapRequestRows?.[0]?.id ?? null;
  const assignments: TeamAssignment[] = (assignmentRows ?? []).map((item: { assignment_id: string; user_id: string; assignment_status: string; position_name: string; member_name: string; available_until: string | null }) => ({ id: item.assignment_id, user_id: item.user_id, status: item.assignment_status, available_until: item.available_until, positions: { name: item.position_name }, profiles: { full_name: item.member_name } }));
  const memberOptions = (members ?? []).map((item) => {
    const profile = item.profiles as ProfileRelation;
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
    return { userId: item.user_id, name: name ?? "Membro" };
  });
  const existingAssignments = assignments.map((assignment) => {
    const position = Array.isArray(assignment.positions) ? assignment.positions[0] : assignment.positions;
    return { id: assignment.id, userId: assignment.user_id, positionName: position?.name ?? "" };
  });
  const ownAssignment = ownAssignmentRows?.[0] ? { id: ownAssignmentRows[0].assignment_id, status: ownAssignmentRows[0].assignment_status, availableUntil: ownAssignmentRows[0].available_until as string | null } : null;
  const { data: calendarEvent } = ownAssignment ? await supabase.from("google_calendar_events").select("html_link").eq("assignment_id", ownAssignment.id).maybeSingle() : { data: null };
  const startsAt = new Date(service.starts_at);
  const endsAt = new Date(service.ends_at);
  const tz = viewer.profile.timezone;
  const serviceDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt);
  const confirmedLabel = (assignment: TeamAssignment) => assignment.status === "confirmed"
    ? (assignment.available_until ? `Confirmado até ${formatTime(new Date(assignment.available_until), tz, { hour: "2-digit", minute: "2-digit" })}` : "Confirmado")
    : assignment.status === "replacement_requested" ? "Troca solicitada" : "Aguardando confirmação";
  const publishedTeam = canManage && schedule.status === "published" ? <section className="mt-6 rounded-[1.75rem] bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Users className="text-[var(--church-brand)]" /><h2 className="text-xl font-bold">Pessoas nesta escala</h2></div><span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--church-brand)]">{assignments?.length ?? 0}</span></div><div className="mt-4 divide-y">{assignments?.map((assignment) => { const position = Array.isArray(assignment.positions) ? assignment.positions[0] : assignment.positions; const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles; return <article className="flex items-center justify-between gap-4 py-4" key={`published-${assignment.id}`}><div><strong>{profile?.full_name ?? "Membro"}</strong><p className="text-sm text-[#6b767d]">{position?.name}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${assignment.status === "confirmed" ? (assignment.available_until ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700") : assignment.status === "replacement_requested" ? "bg-amber-100 text-amber-700" : "bg-[var(--church-brand-soft)] text-[var(--church-brand-on-soft)]"}`}>{confirmedLabel(assignment)}</span></article>; })}</div>{!assignments?.length ? <p className="mt-5 text-sm text-[#6b767d]">Nenhuma pessoa adicionada.</p> : null}</section> : null;

  return <main className="mx-auto max-w-5xl px-4 py-7 sm:px-8">
    <Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--church-brand)]" href={message.voltarLote ? `/painel/escalas/lote/revisar/${message.voltarLote}` : message.visao === "minhas" ? "/painel/escalas?visao=minhas" : "/painel/escalas"}><ArrowLeft size={18} /> {message.voltarLote ? "Voltar à revisão do lote" : "Escalas"}</Link>
    <section className="mt-5 rounded-[1.75rem] bg-gradient-to-br from-[var(--church-brand)] to-[var(--church-brand-dark)] p-6 text-white shadow-lg sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold text-white/75">{department.name}</p><h1 className="mt-1 text-3xl font-bold">{service.title}</h1></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${schedule.status === "published" ? "bg-emerald-300/25 text-emerald-100" : "bg-amber-300/25 text-amber-100"}`}>{schedule.status === "published" ? "Publicada" : "Rascunho"}</span></div>
      <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3"><p className="flex items-center gap-2"><CalendarDays size={17} />{formatDate(startsAt, tz, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p><p className="flex items-center gap-2"><Clock3 size={17} />{formatTime(startsAt, tz, { hour: "2-digit", minute: "2-digit" })} às {formatTime(endsAt, tz, { hour: "2-digit", minute: "2-digit" })}</p>{service.location ? <p className="flex items-center gap-2"><MapPin size={17} />{service.location}</p> : null}</div>
      {service.notes ? <p className="mt-5 rounded-xl bg-white/10 p-4 text-sm">{service.notes}</p> : null}
    </section>
    <AuthMessage {...message} />
    {publishedTeam}

    {ownAssignment && schedule.status === "published" ? <section className="mt-6 rounded-[1.75rem] border-2 border-[var(--church-brand-soft)] bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Sua participação</h2>{ownAssignment.status === "replacement_requested" ? <><p className="mt-3 rounded-xl bg-amber-50 p-4 font-semibold text-amber-800">Troca solicitada. Aguardando a resposta da pessoa escolhida.</p>{ownSwapRequestId ? <form action={cancelAssignmentSwap} className="mt-3"><input name="requestId" type="hidden" value={ownSwapRequestId} /><input name="scheduleId" type="hidden" value={schedule.id} /><PendingSubmitButton className="flex min-h-12 w-full items-center justify-center rounded-xl border border-red-300 font-semibold text-red-700" pendingLabel="Cancelando...">Cancelar solicitação de troca</PendingSubmitButton></form> : null}</> : <><p className="mt-1 text-sm text-[#6b767d]">{ownAssignment.status === "confirmed" ? (ownAssignment.availableUntil ? `Sua presença está confirmada até ${formatTime(new Date(ownAssignment.availableUntil), tz, { hour: "2-digit", minute: "2-digit" })}. Você ainda pode solicitar uma troca.` : "Sua presença está confirmada. Você ainda pode solicitar uma troca.") : "Confirme sua presença ou solicite uma troca com outra pessoa do setor."}</p><div className="mt-4 grid gap-3">{ownAssignment.status === "pending" ? <ConfirmAssignmentForm assignmentId={ownAssignment.id} endTime={endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })} scheduleId={schedule.id} serviceDate={serviceDate} startTime={startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })} /> : null}{(ownAssignment.status === "pending" || ownAssignment.status === "confirmed") ? <Link className="flex min-h-14 items-center justify-center rounded-2xl border border-[var(--church-brand)] px-5 font-bold text-[var(--church-brand)]" href={`/painel/escalas/${schedule.id}/troca/${ownAssignment.id}`}>Solicitar troca</Link> : null}</div></>}</section> : null}

    {ownAssignment?.status === "confirmed" ? <section className="mt-5 rounded-[1.75rem] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><CalendarPlus className="text-[var(--church-brand)]" /><div><h2 className="font-bold">Google Agenda</h2><p className="text-sm text-[#6b767d]">Receba lembretes 24 horas e 2 horas antes.</p></div></div>{calendarEvent?.html_link ? <a className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300 font-semibold text-emerald-700" href={calendarEvent.html_link} rel="noreferrer" target="_blank">Abrir no Google Agenda <ExternalLink size={17} /></a> : null}<form action={addAssignmentToGoogleCalendar} className="mt-3"><input type="hidden" name="assignmentId" value={ownAssignment.id} /><input type="hidden" name="scheduleId" value={schedule.id} /><button className="min-h-12 w-full rounded-xl bg-[var(--church-brand)] px-5 font-semibold text-white">{calendarEvent ? "Sincronizar ou recriar evento" : "Adicionar ao Google Agenda"}</button></form></section> : null}

    {receivedSwapRequests?.map((request) => { const requester = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles; return <section className="mt-6 rounded-[1.75rem] border border-[var(--church-brand-soft)] bg-[var(--church-brand-soft)] p-5 text-[var(--church-brand-on-soft)]" key={request.id}><h2 className="text-lg font-bold">Convite para troca</h2><p className="mt-2">{requester?.full_name ?? "Um membro"} quer trocar esta escala com você.</p>{request.reason ? <p className="mt-2 text-sm opacity-80">{request.reason}</p> : null}<form action={respondToPeerSwap} className="mt-4 grid grid-cols-2 gap-3"><input type="hidden" name="requestId" value={request.id} /><input type="hidden" name="scheduleId" value={schedule.id} /><button className="min-h-12 rounded-xl bg-emerald-600 font-semibold text-white" name="decision" value="accept">Aceitar troca</button><button className="min-h-12 rounded-xl border border-red-300 bg-white font-semibold text-red-700" name="decision" value="reject">Recusar</button></form></section>; })}

    {canManage ? <details className="mt-6 rounded-2xl border border-[#d7dee7] bg-white p-5"><summary className="cursor-pointer font-bold text-[var(--church-brand)]">Editar dados do culto</summary><form action={updateSchedule} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="scheduleId" value={schedule.id} /><input name="voltarLote" type="hidden" value={message.voltarLote ?? ""} /><label className="font-semibold sm:col-span-2">Nome<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] bg-white px-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={service.title} name="title" required /></label><label className="font-semibold">Data<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] bg-white px-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={startsAt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })} name="date" type="date" required /></label><span /><label className="font-semibold">Início<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] bg-white px-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })} name="startTime" type="time" required /></label><label className="font-semibold">Término<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] bg-white px-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={endsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" })} name="endTime" type="time" required /></label><label className="font-semibold sm:col-span-2">Local<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] bg-white px-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={service.location ?? ""} name="location" /></label><label className="font-semibold sm:col-span-2">Observações<textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#d7dee7] bg-white p-3 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]" defaultValue={service.notes ?? ""} name="notes" /></label><button className="min-h-12 rounded-xl bg-[var(--church-brand)] font-semibold text-white sm:col-span-2">Salvar alterações</button></form></details> : null}

    {canManage ? <section className="mt-6 rounded-[1.75rem] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Montar equipe</h2><p className="mt-1 text-sm text-[#6b767d]">Marque para adicionar, desmarque para remover — a mudança já é salva na hora.</p><TeamChecklist assignments={existingAssignments} members={memberOptions} positions={positions ?? []} scheduleId={schedule.id} voltarLote={message.voltarLote} /></section> : null}

    {(!canManage || schedule.status === "draft") ? <section className="mt-6 rounded-[1.75rem] bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><Users className="text-[var(--church-brand)]" /><h2 className="text-xl font-bold">Equipe escalada</h2></div><div className="mt-4 divide-y">{assignments?.map((assignment) => { const position = Array.isArray(assignment.positions) ? assignment.positions[0] : assignment.positions; const profile = Array.isArray(assignment.profiles) ? assignment.profiles[0] : assignment.profiles; return <article className="flex items-center justify-between gap-4 py-4" key={assignment.id}><div><strong>{profile?.full_name ?? "Membro"}</strong><p className="text-sm text-[#6b767d]">{position?.name}</p></div><span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--church-brand-on-soft)]">{confirmedLabel(assignment)}</span></article>; })}</div>{!assignments?.length ? <p className="mt-5 text-sm text-[#6b767d]">Nenhuma pessoa adicionada.</p> : null}</section> : null}

    {canManage && swapRequests?.length ? <section className="mt-6 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-bold">Trocas em andamento</h2>{swapRequests.map((request) => { const requester = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles; const suggested = Array.isArray(request.suggested) ? request.suggested[0] : request.suggested; return <p className="mt-3 rounded-xl bg-white p-4" key={request.id}><strong>{requester?.full_name ?? "Membro"}</strong> convidou <strong>{suggested?.full_name ?? "outro membro"}</strong>. Aguardando resposta.</p>; })}</section> : null}
    {canManage && schedule.status === "draft" && message.voltarLote ? <Link className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-bold text-white" href={`/painel/escalas/lote/revisar/${message.voltarLote}`}><ArrowLeft size={20} />Voltar para revisão do lote</Link> : null}
    {canManage && schedule.status === "draft" && !message.voltarLote ? <form action={publishSchedule} className="mt-6"><input type="hidden" name="scheduleId" value={schedule.id} /><PendingSubmitButton className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-bold text-white" pendingLabel="Publicando..."><CheckCircle2 size={20} />Publicar escala</PendingSubmitButton></form> : null}
    {canManage ? <Link className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-[var(--church-brand)] font-semibold text-[var(--church-brand)]" href={`/painel/escalas/nova?data=${startsAt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}`}>Adicionar outro culto neste dia</Link> : null}
    {canManage ? <DeleteScheduleButton scheduleId={schedule.id} /> : null}
  </main>;
}
