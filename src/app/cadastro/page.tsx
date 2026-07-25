import Link from "next/link";
import { signUp } from "@/features/auth/actions";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string }> };

export default async function SignUpPage({ searchParams }: PageProps) {
  const message = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6fb] px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(41,30,83,.10)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#6827d8]">ATOS</p>
        <h1 className="mt-3 text-3xl font-bold">Criar sua conta</h1>
        <p className="mt-2 text-[#6f6b7d]">Depois do cadastro, a administradora vinculará você à igreja e aos setores.</p>
        <AuthMessage {...message} />
        <form action={signUp} className="mt-7 space-y-5">
          <label className="block font-medium">Nome completo<input className="mt-2 min-h-14 w-full rounded-xl border border-[#dcd7e5] px-4" name="fullName" autoComplete="name" required /></label>
          <label className="block font-medium">E-mail<input className="mt-2 min-h-14 w-full rounded-xl border border-[#dcd7e5] px-4" name="email" type="email" autoComplete="email" required /></label>
          <label className="block font-medium">Senha<input className="mt-2 min-h-14 w-full rounded-xl border border-[#dcd7e5] px-4" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="min-h-14 w-full rounded-xl bg-[#6827d8] px-5 font-semibold text-white hover:bg-[#5720bd]" type="submit">Criar conta</button>
        </form>
        <p className="mt-7 text-center text-[#6f6b7d]">Já tem conta? <Link className="font-semibold text-[#6827d8]" href="/entrar">Entrar</Link></p>
      </section>
    </main>
  );
}
