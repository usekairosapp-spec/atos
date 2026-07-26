import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { SwapRequestForm } from "@/features/schedules/components/swap-request-form";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { params: Promise<{ scheduleId: string; assignmentId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function SwapPage({ params, searchParams }: PageProps) {
  const [{ scheduleId, assignmentId }, message, viewer] = await Promise.all([params, searchParams, getViewerContext()]);
  if (!viewer) redirect("/entrar");
  const supabase = await createClient();
  const { data: swapRows } = await supabase.rpc("get_my_swap_page_data", { target_schedule_id: scheduleId, target_assignment_id: assignmentId });
  const assignment = swapRows?.[0];
  if (!assignment) notFound();
  const { data: candidateRows } = await supabase.rpc("get_sector_swap_candidates", { target_schedule_id: scheduleId, target_assignment_id: assignmentId });
  const candidates = await Promise.all((candidateRows ?? []).map(async (item: { candidate_user_id: string; candidate_name: string; candidate_avatar_path: string | null; candidate_roles: string[] | null }) => { let avatarUrl: string | null = null; if (item.candidate_avatar_path) { const { data } = await supabase.storage.from("avatars").createSignedUrl(item.candidate_avatar_path, 3600); avatarUrl = data?.signedUrl ?? null; } return { id: item.candidate_user_id, name: item.candidate_name, avatarUrl, roles: item.candidate_roles ?? [] }; }));
  const startsAt = new Date(assignment.service_starts_at);
  return <main className="mx-auto max-w-2xl px-5 py-8 sm:px-8"><Link className="inline-flex items-center gap-2 text-lg font-bold" href={`/painel/escalas/${scheduleId}`}><ArrowLeft /> Solicitar troca</Link><AuthMessage {...message} /><section className="mt-7 rounded-[1.75rem] bg-gradient-to-br from-[#307edc] to-[#2076c5] p-6 text-white shadow-lg"><p className="text-sm font-semibold text-blue-200">Sua escala</p><p className="mt-2 text-lg font-bold">{startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · {startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="mt-2">{assignment.department_name} · {assignment.position_name}</p><p className="mt-1 text-sm text-blue-200">{assignment.service_title}</p></section><SwapRequestForm assignmentId={assignment.assignment_id} candidates={candidates.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))} scheduleId={scheduleId} /></main>;
}
