"use client";

import Link from "next/link";
import { Bell, Building2, LayoutDashboard, UserRoundCheck } from "lucide-react";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/central", label: "Visão geral", icon: LayoutDashboard, badge: null },
  { href: "/central/igrejas", label: "Gerenciar igrejas", icon: Building2, badge: null },
  { href: "/central/solicitacoes", label: "Solicitações", icon: UserRoundCheck, badge: "requests" },
  { href: "/central/notificacoes", label: "Notificações", icon: Bell, badge: "notifications" },
] as const;

export function CentralNavigation({ unreadCount, pendingMembershipCount }: { unreadCount: number; pendingMembershipCount: number }) {
  const pathname = usePathname();

  return <nav className="mt-8 space-y-2" aria-label="Navegação da Central">
    {navigation.map(({ href, label, icon: Icon, badge }) => {
      const active = href === "/central" ? pathname === href : pathname.startsWith(href);
      const count = badge === "requests" ? pendingMembershipCount : badge === "notifications" ? unreadCount : 0;
      return <Link
        aria-current={active ? "page" : undefined}
        className={`flex min-h-12 items-center justify-between rounded-xl px-4 transition ${active ? "bg-white/12 text-white shadow-sm ring-1 ring-white/10" : "text-blue-200 hover:bg-white/5 hover:text-white"}`}
        href={href}
        key={href}
      >
        <span className="flex items-center gap-3"><Icon size={20} />{label}</span>
        {count ? <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-bold ${badge === "requests" ? "bg-amber-400 text-[#0c232c]" : "bg-red-500 text-white"}`}>{count > 9 ? "9+" : count}</span> : null}
      </Link>;
    })}
  </nav>;
}
