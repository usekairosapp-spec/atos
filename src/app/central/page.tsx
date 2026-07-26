import Image from "next/image";
import Link from "next/link";
import { Building2, Church, Palette, UserCog, UsersRound } from "lucide-react";
import { assignChurchAdmin, createChurch } from "@/features/churches/actions";
import { getViewerContext } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { CopyInviteCode } from "@/shared/components/copy-invite-code";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function PlatformCentralPage({ searchParams }: PageProps) {
  const viewer = await getViewerContext();
  const supabase = await createClient();
  const [{ data: churches }, { data: profiles }, { data: memberships }, { data: platformRoles }, message] = await Promise.all([
    supabase.from("churches").select("id, name, status, created_at, logo_path, primary_color, invite_code").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
    supabase.from("church_memberships").select("church_id, user_id, role, status"),
    supabase.from("platform_roles").select("user_id"),
    searchParams,
  ]);
  const platformUserIds = new Set(platformRoles?.map((item) => item.user_id) ?? []);
  const activeMemberships = memberships?.filter((item) => item.status === "active") ?? [];
  const pendingMemberships = memberships?.filter((item) => item.status === "pending") ?? [];

  // Filtrar apenas usuários que:
  // 1. Não são platform admins
  // 2. Têm pelo menos uma membership ativa com uma chiesa ativa
  const activeChurchIds = new Set(churches?.filter((c) => c.status === "active").map((c) => c.id) ?? []);
  const usersWithActiveMemberships = new Set(
    activeMemberships
      .filter((item) => activeChurchIds.has(item.church_id))
      .map((item) => item.user_id)
  );
  const eligibleUsers = profiles?.filter((profile) => !platformUserIds.has(profile.id) && usersWithActiveMemberships.has(profile.id)) ?? [];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Central da plataforma</p><h1 className="mt-2 text-3xl font-bold">Olá, {viewer?.profile.fullName.split(" ")[0]}</h1><p className="mt-2 text-[var(--muted)]">Acompanhe quem utiliza o ATOS e defina os responsáveis por cada igreja.</p>
      <AuthMessage {...message} />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article className="premium-card rounded-2xl p-6 shadow-sm"><Building2 className="text-[#6827d8]" /><strong className="mt-3 block text-3xl">{churches?.length ?? 0}</strong><span className="text-sm text-[var(--muted)]">Igrejas cadastradas</span></article><article className="premium-card rounded-2xl p-6 shadow-sm"><UsersRound className="text-[#6827d8]" /><strong className="mt-3 block text-3xl">{eligibleUsers.length}</strong><span className="text-sm text-[var(--muted)]">Usuários do aplicativo</span></article><article className="premium-card rounded-2xl p-6 shadow-sm"><UserCog className="text-[#6827d8]" /><strong className="mt-3 block text-3xl">{activeMemberships.filter((item) => item.role === "church_admin").length}</strong><span className="text-sm text-[var(--muted)]">Administradores de igreja</span></article><Link className="rounded-2xl bg-[#6827d8] p-6 text-white shadow-sm transition hover:bg-[#5620b8]" href="/central/solicitacoes"><UserCog /><strong className="mt-3 block text-3xl">{pendingMemberships.length}</strong><span className="text-sm text-violet-100">{pendingMemberships.length === 1 ? "Solicitação aguardando análise" : "Solicitações aguardando análise"}</span><span className="mt-3 block text-sm font-bold">Analisar agora →</span></Link></section>

      <section className="premium-card mt-8 rounded-2xl p-6"><h2 className="text-xl font-bold">Cadastrar nova igreja</h2><form action={createChurch} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="central-church-name">Nome da igreja</label><input className="min-h-12 flex-1 rounded-xl border border-[var(--border)] px-4" id="central-church-name" name="name" placeholder="Nome da igreja" required /><PendingSubmitButton className="rounded-xl bg-[var(--brand)] px-6 font-semibold text-white" pendingLabel="Criando...">Criar igreja</PendingSubmitButton></form></section>

      <section className="mt-8 scroll-mt-6" id="igrejas"><h2 className="text-2xl font-bold">Igrejas e responsáveis</h2><div className="mt-4 grid gap-4">{churches?.map((church) => {
        const churchUserIds = new Set(activeMemberships.filter((item) => item.church_id === church.id).map((item) => item.user_id));
        const churchEligibleUsers = eligibleUsers.filter((profile) => churchUserIds.has(profile.id));
        const adminMembership = activeMemberships.find((item) => item.church_id === church.id && item.role === "church_admin");
        const admin = churchEligibleUsers.find((profile) => profile.id === adminMembership?.user_id);
        const memberCount = activeMemberships.filter((item) => item.church_id === church.id).length;
        const pendingCount = pendingMemberships.filter((item) => item.church_id === church.id).length;
        const logoUrl = church.logo_path ? supabase.storage.from("church-branding").getPublicUrl(church.logo_path).data.publicUrl : null;
        return <article className="premium-card rounded-2xl p-6" key={church.id}><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex items-start gap-4">{logoUrl ? <Image alt={`Logo de ${church.name}`} className="h-14 w-14 rounded-2xl bg-[var(--surface-soft)] object-contain p-1" height={56} src={logoUrl} width={56} unoptimized /> : <span className="grid h-14 w-14 place-items-center rounded-2xl text-white" style={{ backgroundColor: church.primary_color }}><Church size={25} /></span>}<div><p className="text-xl font-bold">{church.name}</p><p className="mt-1 text-sm text-[var(--muted)]">{memberCount} {memberCount === 1 ? "membro ativo" : "membros ativos"}{pendingCount ? ` · ${pendingCount} aguardando aprovação` : ""}</p><p className="mt-1 text-sm"><strong>Responsável:</strong> {admin?.full_name || admin?.email || "Ainda não definido"}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold tracking-[.14em]">{church.invite_code}</span><CopyInviteCode code={church.invite_code} /></div></div></div><div className="flex flex-col gap-3 xl:flex-row"><Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 font-semibold text-[var(--brand)]" href={`/central/igrejas/${church.id}`}><Palette size={18} />Personalizar</Link><form action={assignChurchAdmin} className="flex flex-col gap-3"><input type="hidden" name="churchId" value={church.id} /><fieldset className="rounded-xl border border-[var(--border)] p-3"><legend className="px-2 text-sm font-semibold">Escolha um ou mais responsáveis</legend><div className="mt-2 grid gap-2">{churchEligibleUsers.length > 0 ? churchEligibleUsers.map((profile) => <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg bg-[var(--surface-soft)] px-3 font-medium" key={profile.id}><input className="h-5 w-5 accent-[var(--brand)]" name="userId" type="checkbox" value={profile.id} />{profile.full_name || profile.email || "Usuário"}</label>) : <p className="py-2 text-sm text-[var(--muted)]">Nenhum membro ativo nesta igreja</p>}</div></fieldset><PendingSubmitButton className="min-h-12 rounded-xl border border-[var(--brand)] px-4 font-semibold text-[var(--brand)] disabled:opacity-50" disabled={!churchEligibleUsers.length} pendingLabel="Definindo...">Definir responsáveis</PendingSubmitButton></form></div></div></article>;
      })}</div></section>

      <section className="premium-card mt-8 rounded-2xl p-6 shadow-sm"><h2 className="text-xl font-bold">Usuários cadastrados</h2><div className="mt-4 divide-y divide-[var(--border)]">{eligibleUsers.map((profile) => <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row" key={profile.id}><strong>{profile.full_name || "Usuário sem nome"}</strong><span className="text-sm text-[var(--muted)]">{profile.email || "E-mail não informado"}</span></div>)}</div></section>
    </main>
  );
}
