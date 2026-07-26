import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { createSchedule } from "@/features/schedules/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string; data?: string }> };

export default async function NewSchedulePage({ searchParams }: PageProps) {
  const [viewer, message] = await Promise.all([getViewerContext(), searchParams]);
  if (!viewer?.currentChurch || (!viewer.isLeader && !viewer.isChurchAdmin)) redirect("/painel/escalas?erro=Sem permissão para criar escalas.");
  const leaderDepartmentIds = viewer.departmentMemberships.filter((item) => item.role === "leader").map((item) => item.department_id);
  const supabase = await createClient();
  const departmentsQuery = supabase.from("departments").select("id, name").eq("church_id", viewer.currentChurch.id).eq("active", true).order("name");
  const { data: departments } = leaderDepartmentIds.length > 0 ? await departmentsQuery.in("id", leaderDepartmentIds) : await departmentsQuery;
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#ddd7e7] bg-white px-4 text-gray-900 outline-none focus:border-[#6827d8] dark:bg-[#2a2736] dark:text-white dark:border-[#3d3549]";
  return <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8"><Link className="inline-flex items-center gap-2 font-semibold text-[#6827d8]" href="/painel/escalas"><ArrowLeft size={18} /> Escalas</Link><p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[#6827d8]">Nova escala</p><h1 className="mt-2 text-3xl font-bold">Dados do evento</h1><p className="mt-2 text-[#6f6b7d]">Ela ficará como rascunho até você montar a equipe e publicar.</p><AuthMessage {...message} />
    <form action={createSchedule} className="mt-8 grid gap-5 rounded-[1.75rem] bg-white p-6 shadow-sm sm:grid-cols-2">
      <label className="font-semibold sm:col-span-2">Data do culto<input className={inputClass} defaultValue={message.data} name="date" type="date" required /></label>
      <label className="font-semibold sm:col-span-2">Setor que você vai escalar<select className={inputClass} name="departmentId" required><option value="">Selecione</option>{departments?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="font-semibold sm:col-span-2">Nome do evento<input className={inputClass} name="title" placeholder="Ex.: Culto de domingo" required /></label>
      <label className="font-semibold">Horário de início<input className={inputClass} name="startTime" type="time" required /></label><label className="font-semibold">Horário de término<input className={inputClass} name="endTime" type="time" required /></label>
      <label className="font-semibold sm:col-span-2">Local<input className={inputClass} name="location" placeholder="Ex.: Templo principal" /></label>
      <label className="font-semibold sm:col-span-2">Observações<textarea className={`${inputClass} min-h-28 py-3`} name="notes" placeholder="Orientações para a equipe" /></label>
      <button className="min-h-12 rounded-xl bg-[#6827d8] px-5 font-semibold text-white sm:col-span-2">Criar rascunho e montar equipe</button>
    </form>
  </main>;
}
