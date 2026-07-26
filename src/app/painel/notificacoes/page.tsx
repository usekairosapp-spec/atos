import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/features/notifications/actions";
import { getViewerContext } from "@/features/auth/viewer";
import { DEFAULT_TIMEZONE, formatDate } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ aba?: string }> };

export default async function NotificationsPage({ searchParams }: PageProps) {
  const [{ aba }, viewer, supabase] = await Promise.all([searchParams, getViewerContext(), createClient()]); const onlyUnread = aba === "nao-lidas";
  let query = supabase.from("notifications").select("id, title, body, href, read_at, created_at").eq("church_id", viewer?.currentChurch?.id ?? "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).limit(100);
  if (onlyUnread) query = query.is("read_at", null);
  const { data: notifications } = await query;
  const tz = viewer?.profile.timezone ?? DEFAULT_TIMEZONE;
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold">Notificações</h1>{notifications?.some((item) => !item.read_at) ? <form action={markAllNotificationsRead}><button className="text-sm font-semibold text-[#277ad8]">Marcar como lidas</button></form> : null}</div><nav className="mt-7 grid grid-cols-2 border-b"><Link className={`pb-4 text-center font-semibold ${!onlyUnread ? "border-b-2 border-[#277ad8] text-[#277ad8]" : "text-[#717880]"}`} href="/painel/notificacoes">Todas</Link><Link className={`pb-4 text-center font-semibold ${onlyUnread ? "border-b-2 border-[#277ad8] text-[#277ad8]" : "text-[#717880]"}`} href="/painel/notificacoes?aba=nao-lidas">Não lidas</Link></nav><div className="divide-y divide-[#eaeef3] bg-white px-2">{notifications?.map((item) => <Link className={`flex gap-4 px-2 py-5 ${item.read_at ? "opacity-60" : ""}`} href={`/painel/notificacoes/${item.id}/abrir`} key={item.id}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-[#277ad8]"><Bell size={22} /></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><strong>{item.title}</strong><small className="whitespace-nowrap text-[#717880]">{formatDate(new Date(item.created_at), tz)}</small></span><span className="mt-1 block text-sm text-[#5d6870]">{item.body}</span></span></Link>)}</div>{!notifications?.length ? <div className="mt-10 text-center text-[#6b767d]"><Bell className="mx-auto" size={40} /><p className="mt-3">Nenhuma notificação {onlyUnread ? "não lida" : "ainda"}.</p></div> : null}</main>;
}
