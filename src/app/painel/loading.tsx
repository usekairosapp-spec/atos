import { LoaderCircle } from "lucide-react";

export default function PanelLoading() {
  return <main aria-busy="true" aria-live="polite" className="mx-auto max-w-5xl px-4 py-7 sm:px-8"><span className="sr-only">Carregando conteúdo</span><div className="flex items-center gap-3 text-[var(--church-brand)]"><LoaderCircle aria-hidden="true" className="animate-spin" size={24} /><span className="font-semibold">Carregando...</span></div><div aria-hidden="true" className="mt-7 animate-pulse space-y-4"><div className="h-8 w-2/3 rounded-lg bg-[var(--church-brand-soft)]" /><div className="h-44 rounded-[1.75rem] bg-white shadow-sm" /><div className="grid gap-4 sm:grid-cols-2"><div className="h-28 rounded-2xl bg-white shadow-sm" /><div className="h-28 rounded-2xl bg-white shadow-sm" /></div></div></main>;
}
