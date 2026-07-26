import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createAnnouncement } from "@/features/announcements/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { DEFAULT_TIMEZONE, formatDate } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function AnnouncementsPage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  if (!viewer?.currentChurch) {
    return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Comunicados</p><h1 className="mt-2 text-3xl font-bold">Meus comunicados</h1><p className="mt-6 text-[#6b767d]">Você precisa estar vinculado a uma igreja para ver comunicados.</p></main>;
  }

  const churchId = viewer.currentChurch.id;
  const isAdmin = viewer.isChurchAdmin;
  const ledDepartmentIds = viewer.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id);
  const canPublish = isAdmin || ledDepartmentIds.length > 0;

  const supabase = await createClient();
  const [{ data: ledDepartments }, { data: announcements }] = await Promise.all([
    canPublish
      ? (isAdmin
        ? supabase.from("departments").select("id, name").eq("church_id", churchId).eq("active", true).order("name")
        : supabase.from("departments").select("id, name").in("id", ledDepartmentIds).eq("active", true).order("name"))
      : Promise.resolve({ data: [] }),
    supabase.from("announcements").select("id, title, body, department_id, target_user_id, created_at, departments(name), profiles!announcements_created_by_fkey(full_name)").eq("church_id", churchId).order("created_at", { ascending: false }).limit(30),
  ]);

  let eligibleMembers: { id: string; name: string }[] = [];
  if (canPublish) {
    if (isAdmin) {
      const { data } = await supabase.from("church_memberships").select("user_id, profiles!church_memberships_user_id_fkey(full_name)").eq("church_id", churchId).eq("status", "active");
      eligibleMembers = (data ?? []).map((item) => {
        const profile = item.profiles as ProfileRelation;
        const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
        return { id: item.user_id, name: name || "Membro" };
      });
    } else {
      const { data } = await supabase.from("department_memberships").select("user_id, profiles!department_memberships_user_id_fkey(full_name)").in("department_id", ledDepartmentIds).eq("status", "active");
      const seen = new Set<string>();
      eligibleMembers = (data ?? []).reduce<{ id: string; name: string }[]>((acc, item) => {
        if (seen.has(item.user_id)) return acc;
        seen.add(item.user_id);
        const profile = item.profiles as ProfileRelation;
        const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
        acc.push({ id: item.user_id, name: name || "Membro" });
        return acc;
      }, []);
    }
    eligibleMembers.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  const tz = viewer.profile.timezone ?? DEFAULT_TIMEZONE;

  return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
    <p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Comunicados</p>
    <h1 className="mt-2 text-3xl font-bold">{canPublish ? "Gerenciar comunicados" : "Meus comunicados"}</h1>
    <AuthMessage {...message} />

    {canPublish ? <section className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold">Publicar novo comunicado</h2>
      <p className="mt-1 text-sm text-[#6b767d]">Escolha para quem enviar: toda a igreja, um setor específico, ou uma única pessoa.</p>
      <form action={createAnnouncement} className="mt-5 grid gap-4">
        <label className="font-semibold">Título<input className="mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] px-4" maxLength={150} name="title" placeholder="Ex.: Ensaio adiado para sábado" required /></label>
        <label className="font-semibold">Mensagem<textarea className="mt-2 min-h-32 w-full rounded-xl border border-[#d7dee7] p-4" maxLength={2000} name="body" placeholder="Escreva o comunicado..." required /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="font-semibold">Destino<select className="mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] px-3" name="scope" required>
            {isAdmin ? <option value="church">Toda a igreja</option> : null}
            {ledDepartments?.map((department) => <option key={department.id} value={`dept:${department.id}`}>Setor: {department.name}</option>)}
          </select></label>
          <label className="font-semibold">Pessoa específica (opcional)<select className="mt-2 min-h-12 w-full rounded-xl border border-[#d7dee7] px-3" defaultValue="" name="targetUserId">
            <option value="">Enviar para o destino selecionado</option>
            {eligibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select></label>
        </div>
        <p className="text-xs text-[#6b767d]">Se você escolher uma pessoa específica, o comunicado será enviado só para ela, mesmo que um destino acima esteja selecionado.</p>
        <PendingSubmitButton className="min-h-12 rounded-xl bg-[var(--church-brand)] px-6 font-semibold text-white" pendingLabel="Publicando...">Publicar comunicado</PendingSubmitButton>
      </form>
    </section> : null}

    <section className="mt-8 space-y-4">
      {announcements?.length ? announcements.map((item) => {
        const department = Array.isArray(item.departments) ? item.departments[0] : item.departments;
        const author = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        const scopeLabel = item.target_user_id ? "Mensagem direta" : department?.name ? `Setor: ${department.name}` : "Toda a igreja";
        return <Link className="block rounded-[1.5rem] bg-white p-5 shadow-sm transition hover:-translate-y-0.5" href={`/painel/comunicados/${item.id}`} key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-[var(--church-brand-soft)] px-3 py-1 text-xs font-semibold text-[var(--church-brand-on-soft)]">{scopeLabel}</span>
            <small className="text-[#717880]">{formatDate(new Date(item.created_at), tz)}</small>
          </div>
          <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-[#6b767d]">{item.body}</p>
          <p className="mt-2 text-xs text-[#717880]">Por {author?.full_name ?? "Liderança"}</p>
        </Link>;
      }) : <div className="rounded-[1.75rem] border border-dashed border-[#c6d2df] bg-white p-8 text-center"><Megaphone className="mx-auto text-[var(--church-brand)]" size={36} /><p className="mt-4 font-semibold">Nenhum comunicado ainda.</p><p className="mt-1 text-sm text-[#6b767d]">{canPublish ? "Publique o primeiro aviso para sua equipe." : "Aqui você receberá os avisos dos líderes."}</p></div>}
    </section>
  </main>;
}
