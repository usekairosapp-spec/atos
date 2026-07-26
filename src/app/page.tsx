import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AtosBrand } from "@/shared/components/atos-brand";
import { ThemeToggle } from "@/shared/components/theme-toggle";

export default async function LandingPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
      redirect(platformRole ? "/central" : "/painel");
    }
  } catch (error) {
    // Se falhar ao conectar com Supabase, deixa a landing page carregar normalmente
    console.error("Erro ao verificar autenticação na landing page:", error);
  }

  return (
    <main className="min-h-screen bg-[#0b0912] px-4 py-4 text-white sm:px-6 sm:py-6">
      <section className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col justify-between overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0%,#7040c8_0%,#21163d_32%,#0b0912_72%)] p-6 shadow-2xl sm:min-h-[calc(100vh-3rem)] sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <header className="relative flex items-center justify-between" aria-label="ATOS"><AtosBrand light /><ThemeToggle /></header>

        <div className="mx-auto max-w-2xl py-16 text-center">
          <span className="mx-auto mb-7 grid h-28 w-28 place-items-center rounded-[2rem] border border-white/15 bg-white/10 shadow-[0_20px_60px_rgba(132,81,236,.28)] backdrop-blur">
            <Image alt="Símbolo ATOS" className="h-24 w-24 object-contain drop-shadow-xl" height={96} priority src="/brand/atos-icon-transparent.png" width={96} />
          </span>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[.22em] text-violet-200">ATOS - Coordenador de Escalas</p>
          <h1 className="text-balance text-4xl font-black leading-tight sm:text-6xl">Organize o serviço.<br />Fortaleça a unidade.</h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-violet-100 sm:text-lg">
            ATOS é um sistema de coordenação de escalas desenvolvido especificamente para igrejas. Ajuda líderes a organizar e comunicar os turnos de serviço, garantindo que todos os membros saibam seus horários e responsabilidades no ministério.
          </p>
          <div className="mx-auto mt-8 flex max-w-lg flex-wrap justify-center gap-3 text-xs font-semibold text-white/80"><span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"><CalendarCheck2 size={15} />Escalas simples</span><span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"><ShieldCheck size={15} />Equipes organizadas</span></div>
        </div>

        <section className="mx-auto mt-12 max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur sm:p-10">
          <h2 className="mb-4 text-2xl font-bold">O que é ATOS?</h2>
          <p className="mb-4 text-violet-100">
            ATOS é um sistema de coordenação de escalas de turnos desenvolvido especificamente para igrejas. O aplicativo web ajuda pastores, líderes de departamentos e coordenadores de equipes a organizar e comunicar os turnos de serviço de forma clara e eficiente. Com ATOS, cada membro da congregação sabe exatamente quando e onde deve servir, reduzindo confusões e melhorando a participação em todos os ministérios.
          </p>
          <ul className="space-y-2 text-violet-100">
            <li>✓ Crie e gerencie escalas de turnos para cada departamento ou setor</li>
            <li>✓ Organize equipes, atribua turnos e defina líderes responsáveis</li>
            <li>✓ Comunique horários de forma clara a todos os membros</li>
            <li>✓ Gerencie múltiplas igrejas, departamentos e equipes em um único lugar</li>
            <li>✓ Acompanhe participação e confirme presença nos turnos</li>
          </ul>
        </section>

        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <Link className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-bold text-[#3f207e] shadow-lg transition hover:-translate-y-0.5" href="/entrar">
            Começar <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <Link className="min-h-12 rounded-xl px-6 py-3 text-center font-medium text-violet-100 hover:bg-white/5" href="/entrar">
            Já tenho uma conta
          </Link>
          <div className="flex justify-center gap-5 text-xs text-violet-200">
            <Link className="underline-offset-4 hover:underline" href="/privacidade">Privacidade</Link>
            <Link className="underline-offset-4 hover:underline" href="/termos">Termos de Uso</Link>
            <a className="underline-offset-4 hover:underline" href="mailto:usekairosapp@gmail.com">Suporte</a>
          </div>
        </div>
      </section>
    </main>
  );
}
