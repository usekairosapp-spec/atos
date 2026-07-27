import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createSchedulesBatch } from "@/features/schedules/actions";
import { MonthDayPicker } from "@/features/schedules/components/month-day-picker";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string; departmentId?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function BatchSchedulePage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  if (!viewer?.currentChurch || (!viewer.isLeader && !viewer.isChurchAdmin)) redirect("/painel/escalas?erro=Sem permissão para criar escalas.");

  const leaderDepartmentIds = viewer.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id);
  const supabase = await createClient();
  const departmentsQuery = supabase.from("departments").select("id, name").eq("church_id", viewer.currentChurch.id).eq("active", true).order("name");
  const { data: departments } = leaderDepartmentIds.length > 0 ? await departmentsQuery.in("id", leaderDepartmentIds) : await departmentsQuery;

  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] bg-white px-4 text-gray-900 outline-none focus:border-[var(--church-brand)] dark:bg-[#273136] dark:text-white dark:border-[#353e49]";

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

  const [{ data: positions }, { data: members }] = await Promise.all([
    supabase.from("positions").select("id, name").eq("department_id", departmentId).eq("active", true).order("name"),
    viewer.isChurchAdmin
      ? supabase.from("church_memberships").select("user_id, profiles!church_memberships_user_id_fkey(full_name)").eq("church_id", viewer.currentChurch.id).eq("status", "active")
      : supabase.from("department_memberships").select("user_id, profiles!department_memberships_user_id_fkey(full_name)").eq("department_id", departmentId).eq("status", "active"),
  ]);

  const today = new Date();

  return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
    <Link className="inline-flex items-center gap-2 font-semibold text-[var(--church-brand)]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link>
    <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Nova escala em lote</p>
    <h1 className="mt-2 text-3xl font-bold">Escolha os dias e monte a equipe</h1>
    <p className="mt-2 text-[#6b767d]">Marque todos os dias que vão ter culto neste mês. O horário, local e a equipe serão aplicados a todos eles — cada um chega para a equipe como uma escala publicada normalmente.</p>
    <AuthMessage {...message} />

    <form action={createSchedulesBatch} className="mt-8 grid gap-6">
      <input name="departmentId" type="hidden" value={departmentId} />

      <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">1. Dias do mês</h2>
        <div className="mt-4">
          <MonthDayPicker initialMonth={today.getMonth()} initialYear={today.getFullYear()} />
        </div>
      </section>

      <section className="grid gap-5 rounded-[1.75rem] bg-white p-6 shadow-sm sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">2. Dados do culto</h2>
        <label className="font-semibold sm:col-span-2">Nome do evento<input className={inputClass} name="title" placeholder="Ex.: Culto de domingo" required /></label>
        <label className="font-semibold">Horário de início<input className={inputClass} name="startTime" type="time" required /></label>
        <label className="font-semibold">Horário de término<input className={inputClass} name="endTime" type="time" required /></label>
        <label className="font-semibold sm:col-span-2">Local<input className={inputClass} name="location" placeholder="Ex.: Templo principal" /></label>
        <label className="font-semibold sm:col-span-2">Observações<textarea className={`${inputClass} min-h-24 py-3`} name="notes" placeholder="Orientações para a equipe" /></label>
      </section>

      <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">3. Equipe (aplicada a todos os dias marcados)</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {positions?.map((position) => <fieldset className="rounded-2xl border border-[#e1e7ef] p-4" key={position.id}>
            <legend className="px-2 font-bold text-[var(--church-brand)]">{position.name}</legend>
            <div className="mt-2 space-y-2">
              {members?.map((item) => {
                const profile = item.profiles as ProfileRelation;
                const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
                return <label className="flex min-h-11 items-center gap-3 rounded-xl bg-[#f6f8fb] px-3 text-gray-900 dark:bg-[#273136] dark:text-white" key={item.user_id}>
                  <input className="h-5 w-5 accent-[var(--church-brand)]" name="selection" type="checkbox" value={`${position.id}|${item.user_id}`} />
                  <span>{name ?? "Membro"}</span>
                </label>;
              })}
            </div>
          </fieldset>)}
        </div>
        {!positions?.length ? <p className="mt-2 text-sm text-amber-700">Cadastre uma função no setor antes de montar a escala.</p> : null}
      </section>

      <PendingSubmitButton className="min-h-14 w-full rounded-2xl bg-[var(--church-brand)] px-6 font-bold text-white" disabled={!positions?.length} pendingLabel="Criando escalas...">Criar e publicar todas as escalas</PendingSubmitButton>
    </form>
  </main>;
}
