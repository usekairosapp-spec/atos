import Link from "next/link";
import { recoverPassword } from "@/features/auth/actions";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string }> };

export default async function RecoveryPage({ searchParams }: PageProps) {
  const message = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6fb] px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(41,30,83,.10)] sm:p-10">
        <h1 className="text-3xl font-bold">Recuperar senha</h1>
        <p className="mt-2 text-[#6f6b7d]">Enviaremos um link seguro para seu e-mail.</p>
        <AuthMessage {...message} />
        <form action={recoverPassword} className="mt-7 space-y-5">
          <label className="block font-medium">E-mail<input className="mt-2 min-h-14 w-full rounded-xl border border-[#dcd7e5] px-4" name="email" type="email" autoComplete="email" required /></label>
          <button className="min-h-14 w-full rounded-xl bg-[#6827d8] px-5 font-semibold text-white" type="submit">Enviar instruções</button>
        </form>
        <Link className="mt-7 block text-center font-semibold text-[#6827d8]" href="/entrar">Voltar para entrar</Link>
      </section>
    </main>
  );
}
