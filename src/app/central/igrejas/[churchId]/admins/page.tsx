import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { promoteToChurchAdmin, removeChurchAdmin } from "@/features/members/actions";
import { AuthMessage } from "@/shared/components/auth-message";
import { ConfirmSubmitButton } from "@/shared/components/confirm-submit-button";
import { getViewerContext } from "@/features/auth/viewer";

type PageProps = { params: Promise<{ churchId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function CentralChurchAdminsPage({ params, searchParams }: PageProps) {
  const [{ churchId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer?.isPlatformAdmin) redirect("/painel?erro=Sem permissão.");

  const supabase = await createClient();
  const [{ data: church }, { data: memberships }, { data: churchAdmins }] = await Promise.all([
    supabase.from("churches").select("id, name").eq("id", churchId).maybeSingle(),
    supabase.from("church_memberships").select("id, user_id, role, status, profiles!church_memberships_user_id_fkey(full_name)").eq("church_id", churchId).eq("status", "active").order("created_at"),
    supabase.from("platform_roles").select("user_id").eq("role", "church_admin"),
  ]);

  if (!church) notFound();

  const activeMembers = memberships ?? [];
  const memberNames = new Map(activeMembers.map((item) => {
    const profile = item.profiles as ProfileRelation;
    return [item.user_id, Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name] as const;
  }));
  const churchAdminIds = new Set(churchAdmins?.map((admin) => admin.user_id) ?? []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link className="inline-flex items-center gap-2 font-semibold text-[var(--brand)]" href="/central/igrejas">
        <ArrowLeft size={18} />
        Voltar para igrejas
      </Link>
      <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Administradoras</p>
      <h1 className="mt-2 text-3xl font-bold">{church.name}</h1>
      <AuthMessage {...message} />

      <section className="mt-8 rounded-[2rem] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold">Administradoras de Igreja</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Gerencie quem tem acesso administrativo completo a esta igreja.</p>

        <div className="mt-6">
          <div className="mb-6 rounded-2xl bg-[var(--surface-soft)] p-4">
            <p className="mb-3 font-semibold">Promover a administradora</p>
            <form action={promoteToChurchAdmin} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="churchId" value={churchId} />
              <select className="flex-1 min-h-12 rounded-xl border border-[var(--border)] px-3" name="userId" required>
                <option value="">Selecione um membro</option>
                {activeMembers.filter((m) => !churchAdminIds.has(m.user_id)).map((item) => {
                  const profile = item.profiles as ProfileRelation;
                  const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
                  return <option value={item.user_id} key={item.user_id}>{name || "Membro"}</option>;
                })}
              </select>
              <button className="min-h-12 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white">Promover</button>
            </form>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {Array.from(churchAdminIds).map((adminId) => {
              const adminMembership = activeMembers.find((m) => m.user_id === adminId);
              if (!adminMembership) return null;
              const profile = adminMembership.profiles as ProfileRelation;
              const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
              return (
                <article className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center" key={adminId}>
                  <div>
                    <p className="font-semibold">{name || "Administradora"}</p>
                    <p className="text-sm text-[var(--muted)]">Administradora da Igreja</p>
                  </div>
                  <form action={removeChurchAdmin}>
                    <input name="userId" type="hidden" value={adminId} />
                    <ConfirmSubmitButton
                      confirmation={`Remover ${name || "esta pessoa"} da administração de ${church.name}?`}
                      className="min-h-11 rounded-xl border border-amber-300 px-4 font-semibold text-amber-800"
                      pendingLabel="Removendo..."
                    >
                      Remover administração
                    </ConfirmSubmitButton>
                  </form>
                </article>
              );
            })}
            {churchAdminIds.size === 0 ? (
              <p className="py-6 text-[var(--muted)]">Nenhuma administradora definida para esta Igreja.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
