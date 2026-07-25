import Image from "next/image";
import Link from "next/link";
import { Church, Palette } from "lucide-react";
import { assignChurchAdmin, deleteChurch } from "@/features/churches/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { DeleteChurchForm } from "@/shared/components/delete-church-form";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { CopyInviteCode } from "@/shared/components/copy-invite-code";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function CentralChurchesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const [{ data: churches }, { data: profiles }, { data: memberships }, { data: platformRoles }, message] = await Promise.all([
    supabase.from("churches").select("id, name, logo_path, primary_color, invite_code, status, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("church_memberships").select("church_id, user_id, role, status"),
    supabase.from("platform_roles").select("user_id"),
    searchParams,
  ]);
  const platformIds = new Set(platformRoles?.map((role) => role.user_id) ?? []);
  const eligibleUsers = profiles?.filter((profile) => !platformIds.has(profile.id)) ?? [];
  const activeMemberships = memberships?.filter((membership) => membership.status === "active") ?? [];

  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Administração da plataforma</p><h1 className="mt-2 text-3xl font-bold">Gerenciar igrejas</h1><p className="mt-2 text-[var(--muted)]">Gerencie responsáveis, identidade visual e o ciclo de vida de cada igreja.</p><AuthMessage {...message} />
    <section className="mt-8 grid gap-5">{churches?.map((church) => {
      const churchUserIds = new Set(activeMemberships.filter((membership) => membership.church_id === church.id).map((membership) => membership.user_id));
      const churchEligibleUsers = eligibleUsers.filter((profile) => churchUserIds.has(profile.id));
      const adminMembership = activeMemberships.find((membership) => membership.church_id === church.id && membership.role === "church_admin");
      const admin = churchEligibleUsers.find((profile) => profile.id === adminMembership?.user_id);
      const memberCount = activeMemberships.filter((membership) => membership.church_id === church.id).length;
      const logoUrl = church.logo_path ? supabase.storage.from("church-branding").getPublicUrl(church.logo_path).data.publicUrl : null;
      return <article className="premium-card rounded-[1.75rem] p-5 sm:p-6" key={church.id}><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex items-center gap-4">{logoUrl ? <Image alt={`Logo de ${church.name}`} className="h-16 w-16 rounded-2xl object-contain" height={64} src={logoUrl} width={64} unoptimized /> : <span className="grid h-16 w-16 place-items-center rounded-2xl text-white" style={{ backgroundColor: church.primary_color }}><Church /></span>}<div><h2 className="text-xl font-bold">{church.name}</h2><p className="mt-1 text-sm text-[var(--muted)]">{memberCount} {memberCount === 1 ? "membro ativo" : "membros ativos"}</p><p className="mt-1 text-sm"><strong>Responsável:</strong> {admin?.full_name || admin?.email || "Ainda não definido"}</p><div className="mt-3 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 font-mono text-sm font-bold tracking-[.14em]">{church.invite_code}</span><CopyInviteCode code={church.invite_code} /></div></div></div><div className="flex flex-col gap-3 sm:flex-row"><Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 font-semibold text-[var(--brand)]" href={`/central/igrejas/${church.id}`}><Palette size={18} />Personalizar</Link><form action={assignChurchAdmin} className="flex flex-col gap-2 sm:flex-row"><input name="churchId" type="hidden" value={church.id} /><select aria-label={`Responsável por ${church.name}`} className="min-h-12 rounded-xl border border-[var(--border)] px-3" defaultValue={admin?.id ?? ""} disabled={!churchEligibleUsers.length} name="userId" required><option value="">{churchEligibleUsers.length ? "Escolha o responsável" : "Nenhum membro ativo nesta igreja"}</option>{churchEligibleUsers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.email || "Usuário"}</option>)}</select><PendingSubmitButton className="min-h-12 rounded-xl border border-[var(--brand)] px-4 font-semibold text-[var(--brand)] disabled:opacity-50" disabled={!churchEligibleUsers.length} pendingLabel="Definindo...">Definir</PendingSubmitButton></form></div></div><DeleteChurchForm action={deleteChurch} churchId={church.id} churchName={church.name} /></article>;
    })}</section>
    {!churches?.length ? <div className="premium-card mt-8 rounded-2xl p-8 text-center"><Church className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-semibold">Nenhuma igreja cadastrada.</p><Link className="mt-4 inline-block font-semibold text-[var(--brand)]" href="/central">Cadastrar igreja</Link></div> : null}
  </main>;
}
