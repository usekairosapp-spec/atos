import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { getViewerContext } from "@/features/auth/viewer";
import { respondToPeerSwap } from "@/features/schedules/actions";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ requestId: string }> };

export default async function SwapInvitationPage({ params }: PageProps) {
  const [{ requestId }, viewer] = await Promise.all([params, getViewerContext()]);
  if (!viewer) redirect("/entrar");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_swap_invitation", { target_request_id: requestId });
  const invitation = data?.[0];
  if (!invitation) notFound();
  const date = new Date(invitation.service_starts_at);
  return <main className="mx-auto max-w-xl px-4 py-7 sm:px-8"><Link className="inline-flex items-center gap-2 font-semibold" href="/painel/notificacoes"><ArrowLeft size={19} /> Notificações</Link><section className="mt-7 rounded-[2rem] bg-gradient-to-br from-[#7130dc] to-[#4f1caf] p-7 text-white shadow-xl"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/15"><ArrowRightLeft size={28} /></span><p className="mt-6 text-violet-200">Convite para troca</p><h1 className="mt-2 text-2xl font-bold">{invitation.requester_name} quer trocar esta escala com você</h1><div className="mt-7 rounded-2xl bg-white/10 p-5"><strong>{invitation.service_title}</strong><p className="mt-2">{date.toLocaleDateString("pt-BR")} · {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p><p className="mt-1">{invitation.department_name} — {invitation.position_name}</p></div>{invitation.reason ? <p className="mt-5 rounded-xl bg-white/10 p-4">“{invitation.reason}”</p> : null}</section><form action={respondToPeerSwap} className="mt-6 grid grid-cols-2 gap-3"><input type="hidden" name="requestId" value={invitation.request_id} /><input type="hidden" name="scheduleId" value={invitation.schedule_id} /><button className="min-h-14 rounded-2xl bg-emerald-600 px-4 font-bold text-white shadow-lg" name="decision" value="accept">Aceitar troca</button><button className="min-h-14 rounded-2xl border border-red-300 bg-white px-4 font-bold text-red-700" name="decision" value="reject">Recusar</button></form></main>;
}
