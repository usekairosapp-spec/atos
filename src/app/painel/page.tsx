import { redirect } from "next/navigation";
import { CalendarDays, Camera, ClipboardList, Clock3, Megaphone, Palette, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { getViewerContext } from "@/features/auth/viewer";
import { createChurch, switchAdminChurch } from "@/features/churches/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { requestMembership } from "@/features/members/actions";

type DashboardProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const supabase = await createClient();
  const viewer = await getViewerContext();
  if (!viewer) redirect("/entrar");

  const [{ data: memberships }, { data: platformRole }, { data: ownAssignments }, message] = await Promise.all([
    supabase.from("church_memberships").select("church_id, role, status"),
    supabase.from("platform_roles").select("role").maybeSingle(),
    supabase.from("schedule_assignments").select("id, status, positions(name), department_schedules!inner(id, status, services(title, starts_at, ends_at), departments(name))").eq("user_id", viewer.user.id),
    searchParams,
  ]);
  const churchIds = memberships?.filter((membership) => membership.status === "active").map((membership) => membership.church_id) ?? [];
  const hasPendingMembership = memberships?.some((membership) => membership.status === "pending") ?? false;
  const firstName = viewer.profile.fullName.split(" ")[0];
  const roleTitle = viewer.role === "admin" ? "Painel administrativo" : viewer.role === "leader" ? "Painel do líder" : "Minha área";
  // eslint-disable-next-line react-hooks/purity
  const dashboardNow = Date.now();
  const nextAssignment = (ownAssignments ?? []).filter((item) => { const schedule = Array.isArray(item.department_schedules) ? item.department_schedules[0] : item.department_schedules; const service = Array.isArray(schedule?.services) ? schedule.services[0] : schedule?.services; return schedule?.status === "published" && service && new Date(service.ends_at).getTime() >= dashboardNow; }).sort((a, b) => { const aSchedule = Array.isArray(a.department_schedules) ? a.department_schedules[0] : a.department_schedules; const bSchedule = Array.isArray(b.department_schedules) ? b.department_schedules[0] : b.department_schedules; const aService = Array.isArray(aSchedule?.services) ? aSchedule.services[0] : aSchedule?.services; const bService = Array.isArray(bSchedule?.services) ? bSchedule.services[0] : bSchedule?.services; return new Date(aService?.starts_at ?? 0).getTime() - new Date(bService?.starts_at ?? 0).getTime(); })[0];
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header><p className="text-sm font-semibold uppercase tracking-[.15em] text-[#277ad8]">{roleTitle}</p><h1 className="mt-2 text-3xl font-bold">Olá, {firstName} 👋</h1></header>
        <AuthMessage {...message} />
        {viewer.isChurchAdmin && viewer.churches.length > 1 ? <section className="premium-card mt-6 rounded-2xl p-4"><form action={switchAdminChurch} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold">Igreja que você está administrando<select className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] px-3" defaultValue={viewer.currentChurch?.id} name="churchId">{viewer.churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label><button className="min-h-12 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white">Trocar igreja</button></form><p className="mt-2 text-xs text-[var(--muted)]">Membros, setores e escalas permanecem totalmente separados por igreja.</p></section> : null}
        {platformRole && churchIds.length === 0 ? (
          <section className="mt-10 rounded-[1.75rem] bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[.15em] text-[#277ad8]">Primeira configuração</p>
            <h2 className="mt-3 text-2xl font-bold">Crie sua igreja</h2>
            <p className="mt-2 text-[#6b767d]">Os setores Técnica, Mídia, Oficiais, Louvor, Recepção e Kids serão criados automaticamente.</p>
            <form action={createChurch} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="church-name">Nome da igreja</label>
              <input className="min-h-14 flex-1 rounded-xl border border-[#d7dee5] px-4" id="church-name" name="name" placeholder="Nome da igreja" required />
              <button className="min-h-14 rounded-xl bg-[#277ad8] px-6 font-semibold text-white" type="submit">Criar igreja</button>
            </form>
          </section>
        ) : null}
        {viewer.currentChurch ? (
          <section className="relative mt-8 overflow-hidden rounded-[2rem] bg-[linear-gradient(130deg,var(--church-brand),#142b3e)] p-6 text-white shadow-xl" style={{ "--church-brand": viewer.churchBranding.primaryColor } as React.CSSProperties}>{viewer.churchBranding.coverUrl ? <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${viewer.churchBranding.coverUrl})` }} /> : null}<div className="absolute inset-0 bg-gradient-to-r from-black/55 to-transparent" /><div className="relative flex items-end justify-between gap-4"><div><p className="text-sm text-white/70">Igreja atual</p><h2 className="text-2xl font-bold">{viewer.currentChurch.name}</h2></div>{viewer.role === "admin" ? <Link className="rounded-xl bg-white/95 px-4 py-3 font-semibold text-[#20558f] shadow-sm" href="/painel/membros">Gerenciar membros</Link> : null}</div></section>
        ) : null}
        {viewer.role === "admin" && churchIds.length > 0 ? <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Link className="premium-card rounded-2xl p-5" href="/painel/membros"><UsersRound className="text-[var(--brand)]" /><strong className="mt-3 block">Membros e líderes</strong><span className="text-sm text-[var(--muted)]">Aprovações e permissões</span></Link><Link className="premium-card rounded-2xl p-5" href="/painel/setores"><ShieldCheck className="text-[var(--brand)]" /><strong className="mt-3 block">Setores</strong><span className="text-sm text-[var(--muted)]">Equipes da igreja</span></Link><Link className="premium-card rounded-2xl p-5" href={viewer.isLeader ? "/painel/escalas" : "/painel/escalas?visao=minhas"}><ClipboardList className="text-[var(--brand)]" /><strong className="mt-3 block">{viewer.isLeader ? "Gerenciar escalas" : "Minhas escalas"}</strong><span className="text-sm text-[var(--muted)]">{viewer.isLeader ? "Criar e editar escalas dos seus setores" : "Seus dias de serviço"}</span></Link>{viewer.isChurchAdmin ? <Link className="premium-card rounded-2xl p-5" href="/painel/igreja"><Palette className="text-[var(--brand)]" /><strong className="mt-3 block">Identidade visual</strong><span className="text-sm text-[var(--muted)]">Logo, capa e cor</span></Link> : null}</section> : null}
        {viewer.role === "leader" ? <section className="mt-8 grid gap-4 sm:grid-cols-2"><Link className="rounded-2xl bg-white p-5 shadow-sm" href="/painel/escalas"><ClipboardList className="text-[#277ad8]" /><strong className="mt-3 block">Gerenciar escalas</strong><span className="text-sm text-[#6b767d]">Somente dos seus setores</span></Link><Link className="rounded-2xl bg-white p-5 shadow-sm" href="/painel/comunicados"><Megaphone className="text-[#277ad8]" /><strong className="mt-3 block">Publicar comunicado</strong><span className="text-sm text-[#6b767d]">Avisos para sua equipe</span></Link></section> : null}
        {!platformRole && churchIds.length === 0 ? (
          <section className="mt-10 rounded-[1.75rem] bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-bold">Entrar em uma igreja</h2>
            <p className="mt-2 text-[#6b767d]">{hasPendingMembership ? "Sua solicitação está aguardando aprovação." : "Solicite o código de convite à administradora."}</p>
            {!hasPendingMembership ? <form action={requestMembership} className="mt-6 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="invite-code">Código de convite</label><input className="min-h-14 flex-1 rounded-xl border border-[#d7dee5] px-4 uppercase" id="invite-code" name="inviteCode" placeholder="CÓDIGO" required /><button className="min-h-14 rounded-xl bg-[#277ad8] px-6 font-semibold text-white">Solicitar entrada</button></form> : null}
          </section>
        ) : null}
        <section className="mt-10 grid gap-5 lg:grid-cols-2">
          {nextAssignment ? (() => { const schedule = Array.isArray(nextAssignment.department_schedules) ? nextAssignment.department_schedules[0] : nextAssignment.department_schedules; const service = Array.isArray(schedule.services) ? schedule.services[0] : schedule.services; const department = Array.isArray(schedule.departments) ? schedule.departments[0] : schedule.departments; const position = Array.isArray(nextAssignment.positions) ? nextAssignment.positions[0] : nextAssignment.positions; const date = new Date(service.starts_at); return <Link className="rounded-[1.75rem] bg-[linear-gradient(145deg,#3182dc,#175797)] p-7 text-white shadow-xl" href={`/painel/escalas/${schedule.id}?visao=minhas`}><p className="text-blue-100">Sua próxima escala</p><div className="mt-5 flex items-center justify-between gap-5"><div><p className="text-sm font-semibold capitalize">{date.toLocaleDateString("pt-BR", { weekday: "long" })}</p><strong className="mt-1 block text-4xl">{date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</strong><p className="mt-3 flex items-center gap-2"><Clock3 size={17} />{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></div><span className="grid h-24 w-24 place-items-center rounded-full border-2 border-white/70"><Camera size={42} /></span></div><h2 className="mt-5 text-center text-2xl font-bold">{department?.name}</h2><p className="text-center text-blue-100">{position?.name}</p><span className={`mx-auto mt-5 block w-fit rounded-full px-4 py-2 text-sm font-semibold ${nextAssignment.status === "confirmed" ? "bg-emerald-400/25 text-emerald-100" : "bg-white/15"}`}>{nextAssignment.status === "confirmed" ? "Confirmado" : "Aguardando confirmação"}</span></Link>; })() : <article className="rounded-[1.75rem] bg-[linear-gradient(145deg,#3182dc,#175797)] p-7 text-white shadow-xl"><p className="text-blue-100">Sua próxima escala</p><h2 className="mt-4 text-2xl font-bold">Nenhuma escala publicada</h2><p className="mt-2 text-blue-100">Quando um líder publicar uma escala, ela aparecerá aqui.</p></article>}
          <Link className="rounded-[1.75rem] bg-white p-7 shadow-sm" href="/painel/calendario">
            <CalendarDays className="text-[#277ad8]" />
            <h2 className="mt-4 text-xl font-bold">{churchIds.length ? "Calendário" : "Aguardando vínculo"}</h2>
            <p className="mt-2 text-[#6b767d]">{churchIds.length ? "Consulte seus próximos compromissos e confirmações." : "A administradora precisa adicionar sua conta a uma igreja e aos setores."}</p>
          </Link>
        </section>
        <section className="mt-5 rounded-[1.75rem] border border-dashed border-[#c6d2df] bg-white/60 p-7 text-center">
          <UsersRound className="mx-auto text-[#818c99]" />
          <p className="mt-3 font-semibold">{viewer.role === "admin" ? "Visão geral de todos os setores." : viewer.role === "leader" ? "Você gerencia apenas os setores atribuídos." : "Aqui aparecerão somente os setores dos quais você participa."}</p>
        </section>
      </div>
    </main>
  );
}
