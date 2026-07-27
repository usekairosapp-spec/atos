import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { ScheduleSelectableList, type ScheduleCardData } from "@/features/schedules/components/schedule-selectable-list";
import { DEFAULT_TIMEZONE, formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string; aba?: string; visao?: string }> };
type AssignmentRow = {
  department_schedule_id: string;
  user_id: string;
  status: string;
  positions: { name: string } | { name: string }[] | null;
};
type MyAssignmentRpcRow = {
  department_schedule_id: string;
  user_id: string;
  assignment_status: string;
  position_name: string;
};

export default async function SchedulesPage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  const supabase = await createClient();
  const schedulesQuery = supabase.from("department_schedules").select("id, department_id, status, departments!inner(name, church_id), services(title, starts_at, ends_at, location)");
  const { data: schedules } = viewer?.currentChurch ? await schedulesQuery.eq("departments.church_id", viewer.currentChurch.id) : await schedulesQuery;
  const scheduleIds = schedules?.map((item) => item.id) ?? [];
  const canManageSchedules = Boolean(viewer?.isLeader || viewer?.isChurchAdmin);
  const [{ data: ownAssignmentRows }, { data: teamAssignmentRows }] = await Promise.all([
    viewer?.currentChurch ? supabase.rpc("get_my_schedule_assignments", { target_church_id: viewer.currentChurch.id }) : Promise.resolve({ data: [] }),
    canManageSchedules && scheduleIds.length ? supabase.from("schedule_assignments").select("department_schedule_id, user_id, status, positions(name)").in("department_schedule_id", scheduleIds) : Promise.resolve({ data: [] }),
  ]);
  const ownAssignments: AssignmentRow[] = (ownAssignmentRows ?? []).map((item: MyAssignmentRpcRow) => ({ department_schedule_id: item.department_schedule_id, user_id: item.user_id, status: item.assignment_status, positions: { name: item.position_name } }));
  const teamAssignments: AssignmentRow[] = (teamAssignmentRows ?? []).map((item: AssignmentRow | MyAssignmentRpcRow) => {
    if ("assignment_status" in item) {
      return { department_schedule_id: item.department_schedule_id, user_id: item.user_id, status: item.assignment_status, positions: { name: item.position_name } };
    }
    return item;
  });
  const leaderView = canManageSchedules;
  const view = message.visao === "minhas" || !leaderView ? "minhas" : "setor";
  const assignments = view === "minhas" || viewer?.role === "member" ? ownAssignments : teamAssignments;
  // Horário capturado no servidor para separar compromissos futuros do histórico.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const tab = message.aba === "historico" ? "historico" : "proximas";
  const ownScheduleIds = new Set(ownAssignments.map((item) => item.department_schedule_id));
  const ledDepartmentIds = new Set(viewer?.isChurchAdmin ? schedules?.map((item) => item.department_id) ?? [] : viewer?.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id) ?? []);
  const visible = (schedules ?? []).filter((item) => { const service = Array.isArray(item.services) ? item.services[0] : item.services; if (!service) return false; if ((viewer?.role === "member" || view === "minhas") && !ownScheduleIds.has(item.id)) return false; if (leaderView && view === "setor" && !ledDepartmentIds.has(item.department_id)) return false; return tab === "proximas" ? new Date(service.ends_at).getTime() >= now : new Date(service.ends_at).getTime() < now; }).sort((a, b) => { const aService = Array.isArray(a.services) ? a.services[0] : a.services; const bService = Array.isArray(b.services) ? b.services[0] : b.services; const delta = new Date(aService?.starts_at ?? 0).getTime() - new Date(bService?.starts_at ?? 0).getTime(); return tab === "proximas" ? delta : -delta; });

  const viewQuery = view === "minhas" ? "visao=minhas" : "";
  const tz = viewer?.profile.timezone ?? DEFAULT_TIMEZONE;
  return <main className="mx-auto max-w-4xl px-4 py-7 sm:px-8"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold">{view === "minhas" ? "Minhas escalas" : "Escalas do setor"}</h1>{canManageSchedules && view === "setor" ? <div className="flex items-center gap-2"><Link className="flex min-h-12 items-center justify-center rounded-full border border-[var(--church-brand)] px-4 text-sm font-semibold text-[var(--church-brand)]" href="/painel/escalas/lote">Criar em lote</Link><Link aria-label="Nova escala" className="grid h-12 w-12 place-items-center rounded-full bg-[var(--church-brand)] text-white shadow-lg" href="/painel/escalas/nova"><Plus /></Link></div> : null}</div><AuthMessage {...message} />
    {leaderView ? <nav className="mt-7 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm"><Link className={`rounded-xl px-3 py-3 text-center font-semibold ${view === "setor" ? "bg-[var(--church-brand)] text-white" : "text-[#6b767d]"}`} href="/painel/escalas">Escalas do setor</Link><Link className={`rounded-xl px-3 py-3 text-center font-semibold ${view === "minhas" ? "bg-[var(--church-brand)] text-white" : "text-[#6b767d]"}`} href="/painel/escalas?visao=minhas">Minhas escalas</Link></nav> : null}
    <nav className="mt-7 grid grid-cols-2 border-b border-[#d7dee7]"><Link className={`pb-4 text-center font-semibold ${tab === "proximas" ? "border-b-2 border-[var(--church-brand)] text-[var(--church-brand)]" : "text-[#717880]"}`} href={`/painel/escalas${viewQuery ? `?${viewQuery}` : ""}`}>Próximas</Link><Link className={`pb-4 text-center font-semibold ${tab === "historico" ? "border-b-2 border-[var(--church-brand)] text-[var(--church-brand)]" : "text-[#717880]"}`} href={`/painel/escalas?${viewQuery ? `${viewQuery}&` : ""}aba=historico`}>Histórico</Link></nav>
    <div className="mt-6">
      {(() => {
        const cards: ScheduleCardData[] = visible.map((schedule) => {
          const service = Array.isArray(schedule.services) ? schedule.services[0] : schedule.services;
          const department = Array.isArray(schedule.departments) ? schedule.departments[0] : schedule.departments;
          const date = new Date(service!.starts_at);
          const myAssignment = assignments?.find((item) => item.department_schedule_id === schedule.id && item.user_id === viewer?.user.id);
          const position = Array.isArray(myAssignment?.positions) ? myAssignment.positions[0] : myAssignment?.positions;
          const status = myAssignment?.status ?? schedule.status;
          const label = status === "confirmed" ? "Confirmado" : status === "replacement_requested" ? "Troca solicitada" : status === "published" && viewer?.role !== "member" ? "Publicada" : status === "draft" ? "Rascunho" : "Pendente";
          const labelClass = label === "Confirmado" ? "bg-emerald-100 text-emerald-700" : label === "Troca solicitada" ? "bg-amber-100 text-amber-700" : "bg-[var(--church-brand-soft)] text-[var(--church-brand-on-soft)]";
          return {
            id: schedule.id,
            href: `/painel/escalas/${schedule.id}${view === "minhas" ? "?visao=minhas" : ""}`,
            day: formatDate(date, tz, { day: "2-digit" }),
            month: formatDate(date, tz, { month: "short" }).replace(".", ""),
            weekdayTime: `${formatDate(date, tz, { weekday: "long" })} · ${formatTime(date, tz, { hour: "2-digit", minute: "2-digit" })}`,
            departmentName: department?.name ?? "",
            subtitle: position?.name ?? service!.title,
            label,
            labelClass,
          };
        });
        return <ScheduleSelectableList canSelect={canManageSchedules && view === "setor"} schedules={cards} />;
      })()}
    </div>
    {!visible.length ? <div className="mt-10 rounded-3xl border border-dashed border-[#c6d0dc] bg-white p-10 text-center"><CalendarDays className="mx-auto text-[var(--church-brand)]" size={36} /><p className="mt-4 font-semibold">Nenhuma escala {tab === "proximas" ? "próxima" : "no histórico"}.</p></div> : null}
  </main>;
}
