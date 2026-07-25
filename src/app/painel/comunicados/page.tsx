import { getViewerContext } from "@/features/auth/viewer";

export default async function AnnouncementsPage() {
  const viewer = await getViewerContext();
  const canPublish = viewer?.role === "admin" || viewer?.role === "leader";
  return <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><p className="text-sm font-semibold uppercase tracking-[.15em] text-[#6827d8]">Comunicados</p><h1 className="mt-2 text-3xl font-bold">{canPublish ? "Gerenciar comunicados" : "Meus comunicados"}</h1><section className="mt-8 rounded-[1.75rem] border border-dashed border-[#cfc6df] bg-white p-8 text-center"><p className="font-semibold">{canPublish ? "Você poderá publicar avisos apenas para as equipes autorizadas." : "Aqui você receberá os avisos dos líderes."}</p></section></main>;
}
