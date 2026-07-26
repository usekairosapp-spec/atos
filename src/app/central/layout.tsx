import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LogOut, UserRoundCheck } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { getViewerContext } from "@/features/auth/viewer";
import { KairosBrand } from "@/shared/components/kairos-brand";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { CentralNavigation } from "@/shared/components/central-navigation";
import { CentralBottomNavigation } from "@/shared/components/central-bottom-navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CentralLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/entrar");
  if (!viewer.isPlatformAdmin) redirect("/painel");
  const supabase = await createClient();
  const [{ count: unreadCount }, { count: pendingMembershipCount }] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("church_memberships").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (
    <div className="min-h-screen bg-[var(--background)] lg:flex">
      <aside className="hidden w-72 shrink-0 bg-[#0c232c] p-6 text-white lg:flex lg:flex-col">
        <Link href="/central"><KairosBrand light /></Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[.15em] text-blue-300">Central da plataforma</p>
        <CentralNavigation unreadCount={unreadCount ?? 0} pendingMembershipCount={pendingMembershipCount ?? 0} />
        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="mb-5 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"><span className="text-sm font-semibold text-blue-100">Tema claro/escuro</span><ThemeToggle /></div>
          <strong className="block truncate text-sm">{viewer.profile.fullName}</strong><small className="text-blue-300">Administradora da plataforma</small><form action={logout}><button className="mt-4 flex items-center gap-2 text-sm text-blue-200"><LogOut size={17} />Sair</button></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 pb-24 lg:pb-0"><header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3 lg:hidden"><KairosBrand compact /><div className="flex items-center gap-1"><Link aria-label={`Solicitações${pendingMembershipCount ? `, ${pendingMembershipCount} pendentes` : ""}`} className="relative grid h-10 w-10 place-items-center" href="/central/solicitacoes"><UserRoundCheck size={20} />{pendingMembershipCount ? <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-[#0c232c]">{pendingMembershipCount > 9 ? "9+" : pendingMembershipCount}</span> : null}</Link><Link aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ""}`} className="relative grid h-10 w-10 place-items-center" href="/central/notificacoes"><Bell size={20} />{unreadCount ? <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}</Link><ThemeToggle /><form action={logout}><button aria-label="Sair da conta" className="grid h-10 w-10 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-50 hover:text-red-700" type="submit"><LogOut size={20} /></button></form></div></header>{children}<CentralBottomNavigation unreadCount={unreadCount ?? 0} pendingMembershipCount={pendingMembershipCount ?? 0} /></div>
    </div>
  );
}
