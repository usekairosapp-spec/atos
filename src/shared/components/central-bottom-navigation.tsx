"use client";

import Link from "next/link";
import { Bell, Building2, LayoutDashboard, UserRoundCheck } from "lucide-react";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/central", label: "Visão geral", icon: LayoutDashboard },
  { href: "/central/igrejas", label: "Igrejas", icon: Building2 },
  { href: "/central/solicitacoes", label: "Solicitações", icon: UserRoundCheck, badge: "requests" },
  { href: "/central/notificacoes", label: "Notificações", icon: Bell, badge: "notifications" },
] as const;

export function CentralBottomNavigation({ unreadCount, pendingMembershipCount }: { unreadCount: number; pendingMembershipCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-3xl justify-around border-t border-[#e7e2ee] bg-white px-1 pt-2 shadow-[0_-8px_25px_rgba(34,22,55,.06)] dark:border-white/10 dark:bg-[#100c2c] [padding-bottom:max(.5rem,env(safe-area-inset-bottom))]" aria-label="Navegação da Central">
      {navigation.map(({ href, label, icon: Icon, badge }) => {
        const active = href === "/central" ? pathname === href : pathname.startsWith(href);
        const count = badge === "requests" ? pendingMembershipCount : badge === "notifications" ? unreadCount : 0;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium sm:min-w-14 sm:text-[11px] relative ${active ? "text-[#6827d8]" : "text-[#6f6b7d]"}`}
            href={href}
            key={href}
          >
            <div className="relative">
              <Icon fill={active ? "currentColor" : "none"} size={21} />
              {count ? (
                <span className={`absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[8px] font-bold ${badge === "requests" ? "bg-amber-400 text-[#100c2c]" : "bg-red-500 text-white"}`}>
                  {count > 9 ? "9+" : count}
                </span>
              ) : null}
            </div>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
