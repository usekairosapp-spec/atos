import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRoundCheck, UserRoundX } from "lucide-react";
import { assignDepartment, removeChurchMember, removeDepartmentLeadership, reviewMembership } from "@/features/members/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { ConfirmSubmitButton } from "@/shared/components/confirm-submit-button";
import { getViewerContext } from "@/features/auth/viewer";
import { CopyInviteCode } from "@/shared/components/copy-invite-code";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };
type ProfileRelation = { full_name: string } | { full_name: string }[] | null;

export default async function MembersPage({ searchParams }: PageProps) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/entrar");
  if (viewer.role !== "admin" || !viewer.currentChurch) redirect("/painel?erro=Sem permissão administrativa.");
  const supabase = await createClient();

  const [{ data: church }, { data: memberships }, { data: departments }, { data: departmentMemberships }, { data: allDepartmentMemberships }, message] = await Promise.all([
    supabase.from("churches").select("name, invite_code").eq("id", viewer.currentChurch.id).single(),
    supabase.from("church_memberships").select("id, user_id, role, status, profiles!church_memberships_user_id_fkey(full_name)").eq("church_id", viewer.currentChurch.id).order("created_at"),
    supabase.from("departments").select("id, name").eq("church_id", viewer.currentChurch.id).eq("active", true).order("name"),
    supabase.from("department_memberships").select("department_id, user_id, role, status, departments!inner(church_id)").eq("departments.church_id", viewer.currentChurch.id).eq("role", "leader").eq("status", "active"),
    supabase.from("department_memberships").select("user_id, role, departments!inner(id, name)").eq("departments.church_id", viewer.currentChurch.id).eq("status", "active"),
    searchParams,
  ]);
  const activeMembers = memberships?.filter((item) => item.status === "active") ?? [];
  const memberNames = new Map(activeMembers.map((item) => {
    const profile = item.profiles as ProfileRelation;
    return [item.user_id, Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name] as const;
  }));
  const departmentNames = new Map(departments?.map((item) => [item.id, item.name]) ?? []);
  const activeLeaders = departmentMemberships?.filter((item) => departmentNames.has(item.department_id)) ?? [];

  const memberDepartments = new Map<string, { name: string; role: string }[]>();
  allDepartmentMemberships?.forEach((dm) => {
    const dept = (dm.departments as any);
    if (dept && dept.name) {
      const key = dm.user_id;
      if (!memberDepartments.has(key)) {
        memberDepartments.set(key, []);
      }
      memberDepartments.get(key)?.push({ name: dept.name, role: dm.role });
    }
  });

  return (
    <main className="min-h-screen bg-[#f7f6fb] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link className="inline-flex items-center gap-2 font-semibold text-[#6827d8]" href="/painel"><ArrowLeft size={18} /> Voltar</Link>
        <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm text-[#6f6b7d]">{church?.name}</p><h1 className="text-3xl font-bold">Membros e líderes</h1></div><div className="rounded-xl bg-white px-4 py-3 shadow-sm"><span className="text-xs text-[#6f6b7d]">Código de convite</span><p className="mt-1 text-lg font-bold tracking-widest text-[#6827d8]">{church?.invite_code}</p>{church?.invite_code ? <div className="mt-2"><CopyInviteCode code={church.invite_code} /></div> : null}</div></div>
        <AuthMessage {...message} />

        <section className="mt-8 rounded-[1.5rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Solicitações pendentes</h2>
          <div className="mt-4 divide-y divide-[#ece8f1]">
            {memberships?.filter((item) => item.status === "pending").map((item) => {
              const profile = item.profiles as ProfileRelation;
              const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
              return <article className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center" key={item.id}><div><p className="font-semibold">{name || "Novo membro"}</p><p className="text-sm text-[#6f6b7d]">Aguardando aprovação</p></div><div className="flex gap-2"><form action={reviewMembership}><input type="hidden" name="membershipId" value={item.id} /><input type="hidden" name="decision" value="rejected" /><PendingSubmitButton className="rounded-xl border border-[#ddd7e7] px-4 py-2 font-semibold" pendingLabel="Recusando...">Recusar</PendingSubmitButton></form><form action={reviewMembership}><input type="hidden" name="membershipId" value={item.id} /><input type="hidden" name="decision" value="active" /><PendingSubmitButton className="rounded-xl bg-[#159867] px-4 py-2 font-semibold text-white" pendingLabel="Aprovando...">Aprovar</PendingSubmitButton></form></div></article>;
            })}
            {!memberships?.some((item) => item.status === "pending") ? <p className="py-6 text-[#6f6b7d]">Nenhuma solicitação pendente.</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Adicionar ao setor ou à liderança</h2>
          <p className="mt-1 text-sm text-[#6f6b7d]">Cada setor pode ter dois ou mais líderes. Ao designar alguém, o painel dessa pessoa muda automaticamente.</p>
          <form action={assignDepartment} className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="font-semibold">Pessoa<select className="mt-2 min-h-12 w-full rounded-xl border border-[#ddd7e7] px-3" name="userId" required><option value="">Selecione o membro</option>{activeMembers.map((item) => { const profile = item.profiles as ProfileRelation; const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name; return <option value={item.user_id} key={item.user_id}>{name || "Membro"}</option>; })}</select></label>
              <label className="font-semibold">Papel nas equipes selecionadas<select className="mt-2 min-h-12 w-full rounded-xl border border-[#ddd7e7] px-3" name="role"><option value="member">Membro</option><option value="leader">Líder</option></select></label>
            </div>
            <fieldset className="rounded-2xl border border-[var(--border)] p-4"><legend className="px-2 font-bold">Equipes</legend><p className="mb-3 text-sm text-[var(--muted)]">Marque uma ou várias. As equipes anteriores da pessoa serão mantidas.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{departments?.map((department) => <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-[var(--surface-soft)] px-4 font-semibold" key={department.id}><input className="h-5 w-5 accent-[var(--brand)]" name="departmentId" type="checkbox" value={department.id} />{department.name}</label>)}</div></fieldset>
            <button className="min-h-12 rounded-xl bg-[#6827d8] px-5 font-semibold text-white"><UserRoundCheck className="mr-2 inline" size={18} />Adicionar às equipes selecionadas</button>
          </form>
        </section>

        <section className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Líderes dos setores</h2>
          <p className="mt-1 text-sm text-[#6f6b7d]">Retirar a liderança mantém a pessoa como membro do setor e atualiza o painel dela.</p>
          <div className="mt-4 divide-y divide-[#ece8f1]">
            {activeLeaders.map((leader) => <article className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center" key={`${leader.department_id}-${leader.user_id}`}><div><p className="font-semibold">{memberNames.get(leader.user_id) || "Líder"}</p><p className="text-sm text-[#6f6b7d]">{departmentNames.get(leader.department_id)}</p></div><form action={removeDepartmentLeadership}><input name="departmentId" type="hidden" value={leader.department_id} /><input name="userId" type="hidden" value={leader.user_id} /><ConfirmSubmitButton confirmation={`Retirar ${memberNames.get(leader.user_id) || "esta pessoa"} da liderança de ${departmentNames.get(leader.department_id)}?`} className="min-h-11 rounded-xl border border-amber-300 px-4 font-semibold text-amber-800" pendingLabel="Atualizando...">Retirar liderança</ConfirmSubmitButton></form></article>)}
            {!activeLeaders.length ? <p className="py-6 text-[#6f6b7d]">Nenhum líder de setor definido.</p> : null}
          </div>
        </section>

        <section className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Membros ativos</h2>
          <p className="mt-1 text-sm text-[#6f6b7d]">A remoção encerra o acesso aos setores e cancela participações futuras, preservando o histórico.</p>
          <div className="mt-4 divide-y divide-[#ece8f1]">
            {activeMembers.map((item) => {
              const profile = item.profiles as ProfileRelation;
              const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
              const userDepts = memberDepartments.get(item.user_id) ?? [];
              const deptDisplay = item.role === "church_admin" ? "Administradora da igreja" : userDepts.length > 0 ? userDepts.map(d => d.name).join(", ") : "Sem setor";
              return <article className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center" key={item.id}><div><p className="font-semibold">{name || "Membro"}</p><p className="text-sm text-[#6f6b7d]">{deptDisplay}</p></div>{item.role !== "church_admin" ? <form action={removeChurchMember}><input name="membershipId" type="hidden" value={item.id} /><ConfirmSubmitButton confirmation={`Remover ${name || "este membro"} da igreja e cancelar suas participações futuras?`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 px-4 font-semibold text-red-700" pendingLabel="Removendo..."><UserRoundX size={18} />Remover</ConfirmSubmitButton></form> : <span className="text-sm font-semibold text-[#6f6b7d]">Protegida</span>}</article>;
            })}
            {!activeMembers.length ? <p className="py-6 text-[#6f6b7d]">Nenhum membro ativo.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
