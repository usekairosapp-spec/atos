import { Building2, UserRoundCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { platformReviewMembership } from "@/features/members/actions";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { DEFAULT_TIMEZONE, formatDate } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };
type Relation<T> = T | T[] | null;

export default async function CentralMembershipRequestsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const [{ data: requests }, message] = await Promise.all([
    supabase.from("church_memberships").select("id, created_at, user_id, churches(name), profiles!church_memberships_user_id_fkey(full_name, email)").eq("status", "pending").order("created_at"),
    searchParams,
  ]);
  return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Central da plataforma</p><h1 className="mt-2 text-3xl font-bold">Solicitações de membros</h1><p className="mt-2 text-[var(--muted)]">Aprove ou recuse solicitações identificando sempre a igreja de destino.</p><AuthMessage {...message} />
    <section className="premium-card mt-8 divide-y divide-[var(--border)] overflow-hidden rounded-[1.75rem]">{requests?.map((request) => { const church = (Array.isArray(request.churches) ? request.churches[0] : request.churches) as Relation<{ name: string }>; const profile = (Array.isArray(request.profiles) ? request.profiles[0] : request.profiles) as Relation<{ full_name: string; email: string | null }>; return <article className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center" key={request.id}><div><strong className="text-lg">{profile && !Array.isArray(profile) ? profile.full_name || profile.email || "Novo membro" : "Novo membro"}</strong><p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--brand)]"><Building2 size={15} />{church && !Array.isArray(church) ? church.name : "Igreja"}</p><p className="mt-1 text-xs text-[var(--muted)]">Solicitado em {formatDate(new Date(request.created_at), DEFAULT_TIMEZONE)}</p></div><div className="flex gap-2"><form action={platformReviewMembership}><input name="membershipId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="rejected" /><PendingSubmitButton className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold text-red-700" pendingLabel="Recusando...">Recusar</PendingSubmitButton></form><form action={platformReviewMembership}><input name="membershipId" type="hidden" value={request.id} /><input name="decision" type="hidden" value="active" /><PendingSubmitButton className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-semibold text-white" pendingLabel="Aprovando..."><UserRoundCheck size={18} />Aprovar</PendingSubmitButton></form></div></article>; })}</section>
    {!requests?.length ? <div className="mt-10 text-center text-[var(--muted)]"><UserRoundCheck className="mx-auto" size={40} /><p className="mt-3">Nenhuma solicitação aguardando análise.</p></div> : null}
  </main>;
}
