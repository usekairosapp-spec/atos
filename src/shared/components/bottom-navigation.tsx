"use client";

import Link from "next/link";
import { CalendarDays, Church, CircleUserRound, ClipboardList, House, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ViewerRole } from "@/features/auth/viewer";

const items = {
  admin: [
    ["/painel", "Início", House], ["/painel/escalas", "Gerenciar", ClipboardList], ["/painel/calendario", "Calendário", CalendarDays], ["/painel/membros", "Membros", UsersRound], ["/painel/setores", "Setores", Church], ["/painel/perfil", "Perfil", CircleUserRound],
  ],
  leader: [
    ["/painel", "Início", House], ["/painel/escalas", "Gerenciar", ClipboardList], ["/painel/calendario", "Calendário", CalendarDays], ["/painel/setores", "Meu setor", Church], ["/painel/perfil", "Perfil", CircleUserRound],
  ],
  member: [
    ["/painel", "Início", House], ["/painel/escalas", "Escalas", CalendarDays], ["/painel/calendario", "Calendário", CalendarDays], ["/painel/perfil", "Perfil", CircleUserRound],
  ],
} satisfies Record<ViewerRole, Array<[string, string, typeof House]>>;

export function BottomNavigation({ role }: { role: ViewerRole }) {
  const pathname = usePathname();
  const navigationItems = items[role];
  return <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-3xl justify-around border-t border-[#e2e7ee] bg-white px-1 pt-2 shadow-[0_-8px_25px_rgba(22,38,55,.06)] [padding-bottom:max(.5rem,env(safe-area-inset-bottom))]" aria-label="Navegação principal">{navigationItems.map(([href, label, Icon]) => { const baseHref = href.split("?")[0]; const active = baseHref === "/painel" ? pathname === baseHref : pathname.startsWith(baseHref); return <Link aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium sm:min-w-14 sm:text-[11px] ${active ? "text-[var(--church-brand)]" : "text-[#6b767d]"}`} href={href} key={href}><Icon fill={active ? "currentColor" : "none"} size={21} /><span>{label}</span></Link>; })}</nav>;
}
