import Link from "next/link";
import { Bell, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { markAllPlatformNotificationsRead } from "@/features/notifications/actions";
import { DEFAULT_TIMEZONE, formatDate } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ aba?: string }> };

export default async function CentralNotificationsPage({ searchParams }: PageProps) {
  const { aba } = await searchParams;
  const onlyUnread = aba === "nao-lidas";
  const supabase = await createClient();
  let query = supabase.from("notifications").select("id, title, body, href, read_at, created_at, churches(name)").order("created_at", { ascending: false }).limit(100);
  if (onlyUnread) query = query.is("read_at", null);
  const { data: notifications } = await query;
  return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Central da plataforma</p><h1 className="mt-2 text-3xl font-bold">Notificações</h1></div>{notifications?.some((item) => !item.read_at) ? <form action={markAllPlatformNotificationsRead}><button className="text-sm font-semibold text-[var(--brand)]">Marcar como lidas</button></form> : null}</div><nav className="mt-7 grid grid-cols-2 border-b border-[var(--border)]"><Link className={`pb-4 text-center font-semibold ${!onlyUnread ? "border-b-2 border-[var(--brand)] text-[var(--brand)]" : "text-[var(--muted)]"}`} href="/central/notificacoes">Todas</Link><Link className={`pb-4 text-center font-semibold ${onlyUnread ? "border-b-2 border-[var(--brand)] text-[var(--brand)]" : "text-[var(--muted)]"}`} href="/central/notificacoes?aba=nao-lidas">Não lidas</Link></nav><section className="premium-card mt-5 divide-y divide-[var(--border)] overflow-hidden rounded-2xl">{notifications?.map((item) => { const church = Array.isArray(item.churches) ? item.churches[0] : item.churches; return <a className={`flex gap-4 p-5 ${item.read_at ? "opacity-60" : ""}`} href={`/central/notificacoes/${item.id}/abrir`} key={item.id}><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-100 text-[var(--brand)]"><Bell size={21} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-2"><strong>{item.title}</strong><small className="text-[var(--muted)]">{formatDate(new Date(item.created_at), DEFAULT_TIMEZONE)}</small></span><span className="mt-1 block text-sm text-[var(--muted)]">{item.body}</span>{church?.name ? <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--brand)]"><Building2 size={13} />{church.name}</span> : null}</span></a>; })}</section>{!notifications?.length ? <div className="mt-10 text-center text-[var(--muted)]"><Bell className="mx-auto" size={40} /><p className="mt-3">Nenhuma notificação {onlyUnread ? "não lida" : "ainda"}.</p></div> : null}</main>;
}
