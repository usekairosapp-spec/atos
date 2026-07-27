import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Pencil } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { publishScheduleBatch } from "@/features/schedules/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { DEFAULT_TIMEZONE, formatDate, formatTime } from "@/shared/lib/timezone";

type PageProps = { params: Promise<{ batchId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> };
type ServiceRelation = { title: string; starts_at: string; ends_at: string; location: string | null } | { title: string; starts_at: string; ends_at: string; location: string | null }[] | null;
type DepartmentRelation = { name: string; church_id: string } | { name: string; church_id: string }[] | null;

export default async function ReviewBatchPage({ params, searchParams }: PageProps) {
  const [{ batchId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer?.currentChurch) redirect("/entrar");
  const supabase = await createClient();

  const [{ data: schedules }, { data: team }] = await Promise.all([
    supabase.from("department_schedules")
      .select("id, status, department_id, departments(name, church_id), services(title, starts_at, ends_at, location)")
      .eq("batch_id", batchId)
      .order("created_at"),
    supabase.rpc("get_batch_team", { target_batch_id: batchId }),
  ]);

  if (!schedules?.length) notFound();
  const firstDepartment = Array.isArray(schedules[0].departments) ? schedules[0].departments[0] : schedules[0].departments;
  if (!firstDepartment || firstDepartment.church_id !== viewer.currentChurch.id) notFound();
  const canManage = viewer.isChurchAdmin || viewer.departmentMemberships.some((item) => item.department_id === schedules[0].department_id && item.role === "leader");
  if (!canManage) redirect("/painel/escalas?erro=Sem permissão para revisar este lote.");

  const teamBySchedule = new Map<string, { position_name: string; member_name: string }[]>();
  for (const row of team ?? []) {
    const list = teamBySchedule.get(row.schedule_id) ?? [];
    list.push({ position_name: row.position_name, member_name: row.member_name });
    teamBySchedule.set(row.schedule_id, list);
  }

  const allPublished = schedules.every((item) => item.status === "published");
  const tz = viewer.profile.timezone ?? DEFAULT_TIMEZONE;

  return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link>
    <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Revisar antes de publicar</p>
    <h1 className="mt-2 text-3xl font-bold">Confira cada dia</h1>
    <p className="mt-2 text-[#6b767d]">Está tudo certo? Você pode ajustar a equipe de um dia específico sem mexer nos outros. Nada é publicado até você confirmar.</p>
    <AuthMessage {...message} />

    <div className="mt-8 grid gap-4">
      {schedules.map((schedule) => {
        const service = Array.isArray(schedule.services) ? schedule.services[0] : schedule.services;
        if (!service) return null;
        const date = new Date(service.starts_at);
        const members = teamBySchedule.get(schedule.id) ?? [];
        return <article className="rounded-[1.75rem] bg-white p-6 shadow-sm" key={schedule.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold capitalize text-[var(--church-brand)]">{formatDate(date, tz, { weekday: "long", day: "2-digit", month: "long" })}</p>
              <h2 className="mt-1 text-xl font-bold">{service.title}</h2>
              <p className="mt-1 text-sm text-[#6b767d]">{formatTime(date, tz, { hour: "2-digit", minute: "2-digit" })}{service.location ? ` · ${service.location}` : ""}</p>
            </div>
            <Link className="flex items-center gap-1 rounded-full border border-[var(--church-brand)] px-3 py-2 text-sm font-semibold text-[var(--church-brand)]" href={`/painel/escalas/${schedule.id}?voltarLote=${batchId}`}><Pencil size={14} />Ajustar este dia</Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {members.map((member) => <span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--church-brand-on-soft)]" key={`${schedule.id}-${member.member_name}-${member.position_name}`}>{member.member_name} · {member.position_name}</span>)}
            {!members.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Sem ninguém na equipe</span> : null}
          </div>
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
