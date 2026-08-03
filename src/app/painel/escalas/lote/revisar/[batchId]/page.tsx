import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { publishScheduleBatch } from "@/features/schedules/actions";
import { TeamChecklist } from "@/features/schedules/components/team-checklist";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { DEFAULT_TIMEZONE, formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { params: Promise<{ batchId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function ReviewBatchPage({ params, searchParams }: PageProps) {
  const [{ batchId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer?.currentChurch) redirect("/entrar");
  const supabase = await createClient();

  const { data: schedules } = await supabase.from("department_schedules")
    .select("id, status, department_id, departments(name, church_id), services(title, starts_at, ends_at, location)")
    .eq("batch_id", batchId)
    .order("created_at");

  if (!schedules?.length) notFound();
  const firstDepartment = Array.isArray(schedules[0].departments) ? schedules[0].departments[0] : schedules[0].departments;
  if (!firstDepartment || firstDepartment.church_id !== viewer.currentChurch.id) notFound();
  const departmentId = schedules[0].department_id;
  const canManage = viewer.isChurchAdmin || viewer.departmentMemberships.some((item) => item.department_id === departmentId && item.role === "leader");
  if (!canManage) redirect("/painel/escalas?erro=Sem permissão para revisar este lote.");

  const [{ data: team }, { data: positions }, { data: members }] = await Promise.all([
    supabase.rpc("get_batch_team", { target_batch_id: batchId }),
    supabase.from("positions").select("id, name").eq("department_id", departmentId).eq("active", true).order("name"),
    supabase.from("department_memberships").select("user_id, profiles!department_memberships_user_id_fkey(full_name)").eq("department_id", departmentId).eq("status", "active"),
  ]);

  const assignmentsBySchedule = new Map<string, { id: string; userId: string; positionName: string }[]>();
  for (const row of team ?? []) {
    const list = assignmentsBySchedule.get(row.schedule_id) ?? [];
    list.push({ id: row.assignment_id, userId: row.user_id, positionName: row.position_name });
    assignmentsBySchedule.set(row.schedule_id, list);
  }
  const memberOptions = (members ?? []).map((item) => {
    const profile = item.profiles as ProfileRelation;
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
    return { userId: item.user_id, name: name ?? "Membro" };
  });

  const allPublished = schedules.every((item) => item.status === "published");
  const tz = viewer.profile.timezone ?? DEFAULT_TIMEZONE;

  return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link>
    <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Revisar antes de publicar</p>
    <h1 className="mt-2 text-3xl font-bold">Confira cada dia</h1>
    <p className="mt-2 text-[#6b767d]">Marque para adicionar, desmarque para remover — direto aqui, sem entrar em cada escala. Nada é publicado até você confirmar.</p>
    <AuthMessage {...message} />

    <div className="mt-8 grid gap-4">
      {schedules.map((schedule) => {
        const service = Array.isArray(schedule.services) ? schedule.services[0] : schedule.services;
        if (!service) return null;
        const date = new Date(service.starts_at);
        const scheduleAssignments = assignmentsBySchedule.get(schedule.id) ?? [];
        return <article className="rounded-[1.75rem] bg-white p-6 shadow-sm" key={schedule.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold capitalize text-[var(--church-brand)]">{formatDate(date, tz, { weekday: "long", day: "2-digit", month: "long" })}</p>
              <h2 className="mt-1 text-xl font-bold">{service.title}</h2>
              <p className="mt-1 text-sm text-[#6b767d]">{formatTime(date, tz, { hour: "2-digit", minute: "2-digit" })}{service.location ? ` · ${service.location}` : ""}</p>
            </div>
            {schedule.status === "draft" ? <Link className="flex items-center gap-1 rounded-full border border-[var(--church-brand)] px-3 py-2 text-sm font-semibold text-[var(--church-brand)]" href={`/painel/escalas/${schedule.id}?voltarLote=${batchId}`}><Pencil size={14} />Editar horário/local</Link> : null}
          </div>
          {schedule.status === "draft" ? (
            <TeamChecklist assignments={scheduleAssignments} members={memberOptions} positions={positions ?? []} scheduleId={schedule.id} voltarLote={batchId} />
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {scheduleAssignments.map((assignment) => { const member = memberOptions.find((item) => item.userId === assignment.userId); return <span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--church-brand-on-soft)]" key={assignment.id}>{member?.name ?? "Membro"} · {assignment.positionName}</span>; })}
              {!scheduleAssignments.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Sem ninguém na equipe</span> : null}
            </div>
          )}
        </article>;
      })}
    </div>

    {allPublished ? (
      <p className="mt-8 rounded-2xl bg-emerald-50 p-5 text-center font-semibold text-emerald-800">Este lote já foi publicado.</p>
    ) : (
      <form action={publishScheduleBatch} className="mt-8">
        <input name="batchId" type="hidden" value={batchId} />
        <PendingSubmitButton className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white" pendingLabel="Publicando...">
          <CheckCircle2 size={20} />Confirmar e publicar todas as escalas
        </PendingSubmitButton>
      </form>
    )}
  </main>;
}
