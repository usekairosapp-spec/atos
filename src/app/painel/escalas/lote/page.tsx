import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createSchedulesBatch } from "@/features/schedules/actions";
import { MonthDayPicker } from "@/features/schedules/components/month-day-picker";
import { ServiceBlocksForm } from "@/features/schedules/components/service-blocks-form";
import { datesForWeekdayInMonth, detectMonthlyPattern, toSourceSchedule } from "@/features/schedules/lib/detect-pattern";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string; departmentId?: string; replicate?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;
type ServiceRelation = { title: string; starts_at: string; ends_at: string; location: string | null; notes: string | null } | { title: string; starts_at: string; ends_at: string; location: string | null; notes: string | null }[] | null;

export default async function BatchSchedulePage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  if (!viewer?.currentChurch || (!viewer.isLeader && !viewer.isChurchAdmin)) redirect("/painel/escalas?erro=Sem permissão para criar escalas.");

  const leaderDepartmentIds = viewer.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id);
  const supabase = await createClient();
  const departmentsQuery = supabase.from("departments").select("id, name").eq("church_id", viewer.currentChurch.id).eq("active", true).order("name");
  const { data: departments } = leaderDepartmentIds.length > 0 ? await departmentsQuery.in("id", leaderDepartmentIds) : await departmentsQuery;

  const departmentId = message.departmentId && departments?.some((item) => item.id === message.departmentId)
    ? message.departmentId
    : departments?.length === 1
      ? departments[0].id
      : null;

  if (!departments?.length) {
    return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8"><Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link><p className="mt-6 text-[#6b767d]">Você ainda não lidera nenhum setor.</p></main>;
  }

  if (!departmentId) {
    return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link>
      <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Nova escala em lote</p>
      <h1 className="mt-2 text-3xl font-bold">Qual setor?</h1>
      <div className="mt-6 grid gap-3">
        {departments.map((department) => <Link className="rounded-2xl bg-white p-5 font-semibold shadow-sm transition hover:-translate-y-0.5" href={`/painel/escalas/lote?departmentId=${department.id}`} key={department.id}>{department.name}</Link>)}
      </div>
    </main>;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  // Usa Date.UTC explicitamente (em vez do construtor local) para nao depender
  // do fuso horario do servidor ao delimitar os meses — mesma convencao do
  // resto do app (ex.: painel/calendario/page.tsx).
  const previousMonthStart = new Date(Date.UTC(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1)).toISOString();
  const currentMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();
  const nextMonthStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1)).toISOString();

  const [{ data: positions }, { data: members }, { data: previousSchedules }, { data: currentMonthSchedules }] = await Promise.all([
    supabase.from("positions").select("id, name").eq("department_id", departmentId).eq("active", true).order("name"),
    supabase.from("department_memberships").select("user_id, profiles!department_memberships_user_id_fkey(full_name)").eq("department_id", departmentId).eq("status", "active"),
    supabase.from("department_schedules")
      .select("id, services!inner(title, starts_at, ends_at, location, notes), schedule_assignments(position_id, user_id)")
      .eq("department_id", departmentId).eq("status", "published")
      .gte("services.starts_at", previousMonthStart).lt("services.starts_at", currentMonthStart),
    supabase.from("department_schedules")
      .select("id, services!inner(starts_at)")
      .eq("department_id", departmentId)
      .gte("services.starts_at", currentMonthStart).lt("services.starts_at", nextMonthStart),
  ]);

  const sourceSchedules = (previousSchedules ?? []).map((row) => {
    const service = row.services as ServiceRelation;
    const s = Array.isArray(service) ? service[0] : service;
    const assignments = (row.schedule_assignments ?? []).map((a: { position_id: string; user_id: string }) => ({ positionId: a.position_id, userId: a.user_id }));
    return toSourceSchedule({ startsAt: s!.starts_at, endsAt: s!.ends_at, title: s!.title, location: s!.location, notes: s!.notes, assignments });
  });
  const pattern = detectMonthlyPattern(sourceSchedules);

  const alreadyScheduledDates = new Set((currentMonthSchedules ?? []).map((row) => {
    const service = row.services as ServiceRelation;
    const s = Array.isArray(service) ? service[0] : service;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(s!.starts_at));
  }));
  // "Hoje" no fuso de Brasilia: a sugestao de replicacao nao deve incluir dias
  // do mes atual que ja passaram, senao a escala nasce direto no historico.
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(today);

  const suggestedDates = pattern ? datesForWeekdayInMonth(currentYear, currentMonth, pattern.weekday).filter((d) => !alreadyScheduledDates.has(d) && d >= todayIso) : [];
  const showSuggestion = pattern !== null && suggestedDates.length > 0 && message.replicate !== "1";
  const applyReplication = pattern !== null && suggestedDates.length > 0 && message.replicate === "1";

  const currentMonthLabel = today.toLocaleDateString("pt-BR", { month: "long" });
  const previousMonthLabel = previousMonthDate.toLocaleDateString("pt-BR", { month: "long" });

  const memberOptions = (members ?? []).map((item) => {
    const profile = item.profiles as ProfileRelation;
    const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
    return { userId: item.user_id, name: name ?? "Membro" };
  });

  const initialBlock = applyReplication && pattern ? {
    title: pattern.title,
    startTime: pattern.startTime,
    endTime: pattern.endTime,
    location: pattern.location ?? "",
    notes: pattern.notes ?? "",
    selected: pattern.assignments.map((a) => `${a.positionId}|${a.userId}`),
  } : undefined;

  return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link>
    <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Nova escala em lote</p>
    <h1 className="mt-2 text-3xl font-bold">Escolha os dias e monte a equipe</h1>
    <p className="mt-2 text-[#6b767d]">Marque todos os dias que vão ter culto neste mês. O horário, local e a equipe serão aplicados a todos eles — cada um chega para a equipe como uma escala publicada normalmente.</p>
    <AuthMessage {...message} />

    {showSuggestion && pattern ? (
      <section className="mt-6 rounded-[1.75rem] bg-[var(--church-brand-soft)] p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 shrink-0 text-[var(--church-brand)]" size={22} />
          <div>
            <p className="font-bold text-[var(--church-brand-on-soft)]">Padrão detectado</p>
            <p className="mt-1 text-sm text-[var(--church-brand-on-soft)]">
              {previousMonthLabel} teve {pattern.occurrences} {pattern.weekdayLabelPlural} às {pattern.startTime}, com a mesma equipe. Repetir em {currentMonthLabel} ({suggestedDates.length} {suggestedDates.length === 1 ? "data" : "datas"})?
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--church-brand)] px-5 text-center font-semibold text-white" href={`/painel/escalas/lote?departmentId=${departmentId}&replicate=1`}>Replicar mês ({suggestedDates.length} datas)</Link>
              <Link className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[var(--church-brand)] px-5 text-center font-semibold text-[var(--church-brand)]" href={`/painel/escalas/lote?departmentId=${departmentId}`}>Selecionar manualmente</Link>
            </div>
          </div>
        </div>
      </section>
    ) : null}

    {applyReplication && pattern ? (
      <div className="mt-6 flex items-center gap-2 rounded-xl bg-[var(--church-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--church-brand-on-soft)]">
        <Sparkles size={16} /> Replicando o padrão de {previousMonthLabel} — revise antes de confirmar.
      </div>
    ) : null}

    <form action={createSchedulesBatch} className="mt-8 grid gap-6" key={applyReplication ? "replicate" : "manual"}>
      <input name="departmentId" type="hidden" value={departmentId} />

      <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">1. Dias do mês</h2>
        <div className="mt-4">
          <MonthDayPicker initialMonth={currentMonth} initialSelectedDates={applyReplication ? suggestedDates : undefined} initialYear={currentYear} />
        </div>
      </section>

      <ServiceBlocksForm initialBlock={initialBlock} members={memberOptions} positions={positions ?? []} />

      <PendingSubmitButton className="min-h-14 w-full rounded-2xl bg-[var(--church-brand)] px-6 font-bold text-white" disabled={!positions?.length} pendingLabel="Criando escalas...">Criar e publicar todas as escalas</PendingSubmitButton>
    </form>
  </main>;
}
