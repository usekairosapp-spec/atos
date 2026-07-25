import Image from "next/image";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-6 text-center">
      <section className="max-w-sm">
        <Image className="mx-auto h-24 w-24 object-contain" src="/icons/icon-192.png" alt="ATOS" width={96} height={96} priority />
        <h1 className="mt-6 text-3xl font-bold">Você está sem internet</h1>
        <p className="mt-3 text-[var(--muted)]">Conecte-se novamente para acessar suas escalas, confirmações e mensagens atualizadas.</p>
        <a className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--brand)] px-6 font-semibold text-white" href="/painel">Tentar novamente</a>
      </section>
    </main>
  );
}
