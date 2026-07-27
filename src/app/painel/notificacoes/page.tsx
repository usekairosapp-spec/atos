import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/features/notifications/actions";
import { getViewerContext } from "@/features/auth/viewer";
import { DEFAULT_TIMEZONE, formatDate } from "@/shared/lib/timezone";

export default async function NotificationsPage() {
  const [viewer, supabase] = await Promise.all([getViewerContext(), createClient()]);
  const { data: notifications } = await supabase.from("notifications").select("id, title, body, href, read_at, created_at").eq("church_id", viewer?.currentChurch?.id ?? "00000000-0000-0000-0000-000000000000").is("read_at", null).order("created_at", { ascending: false }).limit(100);
  const tz = viewer?.profile.timezone ?? DEFAULT_TIMEZONE;
  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold">Notificações</h1>{notifications?.length ? <form action={markAllNotificationsRead}><button className="text-sm font-semibold text-[var(--church-brand)]">Marcar como lidas</button></form> : null}</div><div className="mt-7 divide-y divide-[#eaeef3] bg-white px-2">{notifications?.map((item) => <Link className="flex gap-4 px-2 py-5" href={`/painel/notificacoes/${item.id}/abrir`} key={item.id}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--church-brand-soft)] text-[var(--church-brand)]"><Bell size={22} /></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><strong>{item.title}</strong><small className="whitespace-nowrap text-[#717880]">{formatDate(new Date(item.created_at), tz)}</small></span><span className="mt-1 block text-sm text-[#5d6870]">{item.body}</span></span></Link>)}</div>{!notifications?.length ? <div className="mt-10 text-center text-[#6b767d]"><Bell className="mx-auto" size={40} /><p className="mt-3">Nenhuma notificação nova.</p></div> : null}</main>;
}
