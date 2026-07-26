import { redirect } from "next/navigation";
import { getViewerContext } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { createDepartment } from "@/features/departments/actions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function DepartmentsPage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  if (!viewer || viewer.role === "member") redirect("/painel?erro=Sem permissão para acessar setores.");
  const supabase = await createClient();
  if (!viewer.currentChurch) redirect("/painel?erro=Nenhuma igreja selecionada.");
  const query = supabase.from("departments").select("id, name, church_id").eq("active", true).order("name");
  const { data: departments } = viewer.role === "admin" ? await query.eq("church_id", viewer.currentChurch.id) : await query.in("id", viewer.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id));

  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
    <p className="text-sm font-semibold uppercase tracking-[.15em] text-[#277ad8]">Equipes</p>
    <h1 className="mt-2 text-3xl font-bold">{viewer.role === "admin" ? "Setores da igreja" : "Meus setores"}</h1>
    <AuthMessage {...message} />

    {viewer.role === "admin" ? <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Criar novo setor</h2>
      <p className="mt-1 text-sm text-[#6b767d]">Adicione um novo setor à sua igreja. Você poderá gerenciar funções e membros após criá-lo.</p>
      <form action={createDepartment} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input className="min-h-12 flex-1 rounded-xl border border-[#d7dee7] px-4 outline-none focus:border-[#277ad8]" name="name" placeholder="Ex.: Som, Louvor, Técnica" required />
        <button className="min-h-12 rounded-xl bg-[#277ad8] px-5 font-semibold text-white"><Plus className="mr-2 inline" size={18} />Criar setor</button>
      </form>
    </section> : null}

    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {departments?.map((department) => <Link className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md" href={`/painel/setores/${department.id}`} key={department.id}>
        <h2 className="text-xl font-bold">{department.name}</h2>
        <p className="mt-2 text-sm text-[#6b767d]">{viewer.role === "admin" ? "Consultar funções do setor" : "Gerenciar funções do seu setor"}</p>
      </Link>)}
    </section>
  </main>;
}
