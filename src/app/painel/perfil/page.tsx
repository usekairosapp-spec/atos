import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { getViewerContext } from "@/features/auth/viewer";
import { AvatarPicker } from "@/features/profile/components/avatar-picker";
import { updateProfile } from "@/features/profile/actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { InstallPwa } from "@/shared/components/install-pwa";
import { TIMEZONE_OPTIONS } from "@/shared/lib/timezone";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function ProfilePage({ searchParams }: PageProps) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/entrar");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", viewer.user.id).single();
  const message = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--church-brand)]">Sua conta</p><h1 className="mt-2 text-3xl font-bold">Perfil</h1>
      <AuthMessage {...message} />
      <form action={updateProfile} className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-sm sm:p-8">
        <AvatarPicker currentAvatarUrl={viewer.profile.avatarUrl} />
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="font-medium">Nome completo<input className="mt-2 min-h-13 w-full rounded-xl border border-[#d7dee5] px-4" name="fullName" defaultValue={viewer.profile.fullName} required /></label>
          <label className="font-medium">Telefone<input className="mt-2 min-h-13 w-full rounded-xl border border-[#d7dee5] px-4" name="phone" type="tel" defaultValue={profile?.phone ?? ""} /></label>
        </div>
        <label className="mt-5 block font-medium">E-mail<input className="mt-2 min-h-13 w-full rounded-xl border border-[#e8ecf1] bg-[#f6f9fb] px-4 text-[#6b767d]" value={viewer.user.email ?? ""} readOnly /></label>
        <label className="mt-5 block font-medium">Fuso horário
          <select className="mt-2 min-h-13 w-full rounded-xl border border-[#d7dee5] px-4" defaultValue={viewer.profile.timezone} name="timezone">
            {TIMEZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span className="mt-1 block text-xs font-normal text-[#6b767d]">Usado para exibir os horários das escalas e sincronizar o Google Agenda. Padrão: Brasília.</span>
        </label>
        <button className="mt-7 min-h-13 rounded-xl bg-[var(--church-brand)] px-6 font-semibold text-white" type="submit">Salvar perfil</button>
      </form>
      <InstallPwa />
      <form action={logout} className="mt-6">
        <button className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 font-semibold text-red-700 transition hover:bg-red-100" type="submit">
          <LogOut size={19} /> Sair da conta
        </button>
      </form>
    </main>
  );
}
