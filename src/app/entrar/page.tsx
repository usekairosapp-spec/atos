import Link from "next/link";
import { Eye, Mail } from "lucide-react";
import { login } from "@/features/auth/actions";
import { AuthMessage } from "@/shared/components/auth-message";
import { KairosBrand } from "@/shared/components/kairos-brand";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { GoogleLoginButton } from "@/shared/components/google-login-button";
import { InstallPwa } from "@/shared/components/install-pwa";

type LoginPageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const message = await searchParams;
  return (
    <main className="grid min-h-screen bg-[var(--background)] lg:grid-cols-[1fr_1.15fr]">
      <aside className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,#4085d1,#172e46_45%,#0a0f14)] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" /><KairosBrand light />
        <div className="max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[.22em] text-blue-200">Sua equipe em sintonia</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">Cada pessoa no lugar certo, na hora certa.</h1>
        </div>
        <p className="text-sm text-blue-200">Técnica · Mídia · Oficiais · Louvor · Recepção · Kids</p>
      </aside>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-10"><div className="absolute right-5 top-5"><ThemeToggle /></div>
        <div className="premium-card w-full max-w-md rounded-[2rem] p-7 sm:p-10">
          <div className="mb-10 lg:hidden"><KairosBrand /></div>
          <h2 className="text-3xl font-bold">Bem-vindo!</h2>
          <p className="mt-2 text-[var(--muted)]">Entre para acessar suas escalas.</p>
          <AuthMessage {...message} />

          <GoogleLoginButton />

          <InstallPwa />

          <details className="mt-6 rounded-xl border border-[#e4e8ee] p-4">
            <summary className="cursor-pointer text-center text-sm font-semibold text-[#6b767d]">Entrar com e-mail e senha</summary>

          <form action={login} className="mt-5 space-y-5">
            <label className="block font-medium">E-mail
              <span className="mt-2 flex min-h-14 items-center gap-3 rounded-xl border border-[#d7dee5] px-4 focus-within:border-[#277ad8]">
                <Mail size={19} aria-hidden="true" className="text-[#7c858d]" />
                <input className="w-full border-0 bg-transparent outline-none" name="email" placeholder="voce@email.com" type="email" autoComplete="email" required />
              </span>
            </label>
            <label className="block font-medium">Senha
              <span className="mt-2 flex min-h-14 items-center gap-3 rounded-xl border border-[#d7dee5] px-4 focus-within:border-[#277ad8]">
                <input className="w-full border-0 bg-transparent outline-none" name="password" type="password" autoComplete="current-password" required />
                <Eye size={19} aria-label="Mostrar senha" className="text-[#7c858d]" />
              </span>
            </label>
            <div className="text-right"><Link className="font-semibold text-[#277ad8]" href="/recuperar-senha">Esqueci minha senha</Link></div>
            <button className="min-h-14 w-full rounded-xl bg-[#277ad8] px-5 font-semibold text-white shadow-lg hover:bg-[#206cbd]" type="submit">Entrar</button>
          </form>
          </details>
          <p className="mt-8 text-center text-[#6b767d]">Ainda não tem conta? <Link className="font-semibold text-[#277ad8]" href="/cadastro">Criar conta</Link></p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-[var(--muted)]">
            <Link className="hover:text-[var(--brand)]" href="/privacidade">Privacidade</Link>
            <Link className="hover:text-[var(--brand)]" href="/termos">Termos de Uso</Link>
            <a className="hover:text-[var(--brand)]" href="mailto:usekairosapp@gmail.com">Suporte</a>
          </div>
        </div>
      </section>
    </main>
  );
}
