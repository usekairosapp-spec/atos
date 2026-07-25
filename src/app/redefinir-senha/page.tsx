import { updatePassword } from "@/features/auth/actions";
import { AuthMessage } from "@/shared/components/auth-message";

type PageProps = { searchParams: Promise<{ erro?: string }> };

export default async function UpdatePasswordPage({ searchParams }: PageProps) {
  const message = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6fb] px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(41,30,83,.10)] sm:p-10">
        <h1 className="text-3xl font-bold">Criar nova senha</h1>
        <p className="mt-2 text-[#6f6b7d]">Use pelo menos oito caracteres.</p>
        <AuthMessage {...message} />
        <form action={updatePassword} className="mt-7 space-y-5">
          <label className="block font-medium">Nova senha<input className="mt-2 min-h-14 w-full rounded-xl border border-[#dcd7e5] px-4" name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="min-h-14 w-full rounded-xl bg-[#6827d8] px-5 font-semibold text-white" type="submit">Salvar nova senha</button>
        </form>
      </section>
    </main>
  );
}
