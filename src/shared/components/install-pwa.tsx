"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPwa() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
        || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setInstalled(standalone);
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    }, 0);

    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
  }

  return (
    <section className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]"><Download size={22} /></span>
        <div>
          <h2 className="text-lg font-bold">Aplicativo ATOS</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{installed ? "O ATOS já está instalado neste dispositivo." : "Instale para abrir em tela cheia e acessar rapidamente pela tela inicial."}</p>
        </div>
      </div>
      {prompt && !installed ? <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 font-semibold text-white" onClick={install} type="button"><Download size={18} /> Instalar aplicativo</button> : null}
      {isIos && !installed ? <p className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]"><Share className="mt-0.5 shrink-0 text-[var(--brand)]" size={18} />No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p> : null}
      {!prompt && !isIos && !installed ? <p className="mt-4 text-sm text-[var(--muted)]">A opção de instalação aparecerá quando o navegador confirmar os requisitos do aplicativo.</p> : null}
    </section>
  );
}
