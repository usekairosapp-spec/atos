import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createPosition, togglePosition, updatePosition } from "@/features/positions/actions";
import { deleteDepartment } from "@/features/departments/actions";
import { RemoveMemberButton } from "@/features/members/components/remove-member-button";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ erro?: string; sucesso?: string }>;
};

export default async function DepartmentDetailPage({ params, searchParams }: PageProps) {
  const [{ departmentId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer || viewer.role === "member") redirect("/painel?erro=Sem permissão para acessar setores.");
  const supabase = await createClient();
  const [{ data: department }, { data: positions }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name, church_id").eq("id", departmentId).single(),
    supabase.from("positions").select("id, name, active").eq("department_id", departmentId).order("active", { ascending: false }).order("name"),
    supabase.from("department_memberships").select("user_id, role, status, profiles!department_memberships_user_id_fkey(full_name)").eq("department_id", departmentId).order("role", { ascending: false }).order("created_at"),
  ]);
  if (!department) redirect("/painel/setores?erro=Setor não encontrado.");
  if (!viewer.currentChurch || department.church_id !== viewer.currentChurch.id) redirect("/painel/setores?erro=Setor não pertence à igreja selecionada.");
  if (viewer.role === "leader" && !viewer.departmentMemberships.some((item) => item.department_id === departmentId && item.role === "leader")) redirect("/painel?erro=Setor não atribuído a este líder.");
  const canEdit = viewer.departmentMemberships.some((item) => item.department_id === departmentId && item.role === "leader");

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <Link className="inline-flex items-center gap-2 font-semibold text-[#277ad8]" href="/painel/setores"><ArrowLeft size={18} /> Setores</Link>
      <p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[#277ad8]">Funções do setor</p><h1 className="mt-2 text-3xl font-bold">{department.name}</h1>
      <AuthMessage {...message} />
      {canEdit ? <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Adicionar nova função</h2><p className="mt-1 text-sm text-[#6b767d]">Como líder, você pode criar quantas funções seu setor precisar.</p><form action={createPosition} className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="hidden" name="departmentId" value={department.id} /><label className="sr-only" htmlFor="position-name">Nome da função</label><input className="min-h-12 flex-1 rounded-xl border border-[#d7dee7] px-4" id="position-name" name="name" placeholder="Ex.: Iluminação" required /><button className="min-h-12 rounded-xl bg-[#277ad8] px-5 font-semibold text-white"><Plus className="mr-2 inline" size={18} />Adicionar</button></form></section> : <p className="mt-6 rounded-xl bg-blue-50 px-4 py-3 text-sm text-[#3167a4]">As funções são gerenciadas pelo líder deste setor.</p>}
      <section className="mt-6 space-y-3">
        {positions?.map((position) => canEdit ? <article className={`rounded-2xl bg-white p-5 shadow-sm ${position.active ? "" : "opacity-60"}`} key={position.id}><form action={updatePosition} className="flex flex-col gap-3 sm:flex-row sm:items-end"><input type="hidden" name="positionId" value={position.id} /><input type="hidden" name="departmentId" value={department.id} /><label className="flex-1 font-medium">Função<input className="mt-2 min-h-11 w-full rounded-xl border border-[#d7dee7] px-3" name="name" defaultValue={position.name} required /></label><button className="rounded-xl border border-[#277ad8] px-4 py-3 font-semibold text-[#277ad8]">Salvar</button></form><form action={togglePosition} className="mt-3"><input type="hidden" name="positionId" value={position.id} /><input type="hidden" name="departmentId" value={department.id} /><input type="hidden" name="active" value={String(!position.active)} /><button className="text-sm font-semibold text-[#6b767d]">{position.active ? "Arquivar função" : "Reativar função"}</button></form></article> : <article className="rounded-2xl bg-white p-5 shadow-sm" key={position.id}><strong>{position.name}</strong></article>)}
      </section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">Membros do setor</h2>
        <p className="mt-1 text-sm text-[#6b767d]">Todos os membros inscritos neste setor</p>
        <div className="mt-4 divide-y divide-[#e8ecf1]">
          {members && members.length > 0 ? members.map((member) => {
            const profile = member.profiles as any;
            const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
            return <article className="flex items-center justify-between py-3" key={member.user_id}>
              <div>
                <p className="font-semibold">{name || "Membro"}</p>
                <p className="text-sm text-[#6b767d]">{member.role === "leader" ? "Líder" : "Membro"} - {member.status === "active" ? "Ativo" : "Inativo"}</p>
              </div>
              {viewer.role === "admin" ? <RemoveMemberButton departmentId={department.id} userId={member.user_id} memberName={name || "Membro"} /> : null}
            </article>;
          }) : <p className="py-6 text-[#6b767d]">Nenhum membro inscrito neste setor.</p>}
        </div>
      </section>

      {viewer.role === "admin" ? <details className="mt-8 rounded-2xl border border-red-100 bg-white p-6"><summary className="flex cursor-pointer items-center gap-2 font-semibold text-red-700"><Trash2 size={18} />Deletar setor</summary><p className="mt-4 text-sm text-[#6b767d]">Esta ação é irreversível. O setor será removido, assim como todas as suas funções e escalas.</p><form action={deleteDepartment} className="mt-4"><input type="hidden" name="departmentId" value={department.id} /><button className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-6 font-semibold text-red-700 w-full">Confirmar exclusão do setor</button></form></details> : null}
    </main>
  );
}
