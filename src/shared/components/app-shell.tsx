import Link from "next/link";
import Image from "next/image";
import { CircleUserRound } from "lucide-react";
import type { ViewerRole } from "@/features/auth/viewer";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { BottomNavigation } from "@/shared/components/bottom-navigation";
import { KairosBrand } from "@/shared/components/kairos-brand";
import { ThemeToggle } from "@/shared/components/theme-toggle";

type AppShellProps = {
  children: React.ReactNode;
  fullName: string;
  avatarUrl: string | null;
  role: ViewerRole;
  unreadCount: number;
  churchName: string | null;
  churchLogoUrl: string | null;
  primaryColor: string;
};

export function AppShell({ children, avatarUrl, role, unreadCount, churchName, churchLogoUrl, primaryColor }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)]" style={{ "--church-brand": primaryColor } as React.CSSProperties}>
      <div className="min-w-0 pb-24">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 py-3 backdrop-blur sm:px-6"><Link className="flex min-w-0 items-center gap-3" href="/painel">{churchLogoUrl ? <Image className="h-10 w-10 rounded-xl object-contain" src={churchLogoUrl} alt={`Logo ${churchName ?? "da igreja"}`} width={40} height={40} unoptimized /> : <KairosBrand compact />}<span className="hidden truncate text-sm font-semibold text-[var(--foreground)] sm:block">{churchName}</span></Link><div className="flex items-center gap-2"><ThemeToggle /><NotificationBell initialCount={unreadCount} /><Link aria-label="Abrir perfil" href="/painel/perfil">{avatarUrl ? <Image className="h-10 w-10 rounded-full object-cover ring-2 ring-[var(--border)]" src={avatarUrl} alt="Perfil" width={40} height={40} unoptimized /> : <CircleUserRound />}</Link></div></header>
        {children}
      </div>

      <BottomNavigation role={role} />
    </div>
  );
}
