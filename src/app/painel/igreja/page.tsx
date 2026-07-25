import Image from "next/image";
import { redirect } from "next/navigation";
import { AtosBrand } from "@/shared/components/atos-brand";
import { AuthMessage } from "@/shared/components/auth-message";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";
import { getViewerContext } from "@/features/auth/viewer";
import { updateChurchBranding } from "@/features/churches/branding-actions";

type PageProps = { searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function ChurchBrandingPage({ searchParams }: PageProps) {
  const viewer = await getViewerContext();
  if (!viewer?.currentChurch || !viewer.isChurchAdmin) redirect("/painel?erro=Sem permissão para personalizar a igreja.");
  const message = await searchParams;
  return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
    <p className="text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Identidade da igreja</p><h1 className="mt-2 text-3xl font-bold">Personalização</h1><p className="mt-2 text-[var(--muted)]">O logo e a capa aparecerão para todos os membros desta igreja.</p>
    <AuthMessage {...message} />
    <section className="premium-card mt-8 overflow-hidden rounded-[2rem]">
      <div className="relative h-48 bg-[linear-gradient(135deg,var(--church-color),#17112d)]" style={{ "--church-color": viewer.churchBranding.primaryColor } as React.CSSProperties}>{viewer.churchBranding.coverUrl ? <Image alt="Capa atual da igreja" className="object-cover opacity-75" fill sizes="900px" src={viewer.churchBranding.coverUrl} unoptimized /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute bottom-5 left-5 flex items-center gap-4">{viewer.churchBranding.logoUrl ? <Image alt="Logo atual" className="h-16 w-16 rounded-2xl bg-white object-contain p-1" height={64} src={viewer.churchBranding.logoUrl} width={64} unoptimized /> : <span className="rounded-2xl bg-white p-3"><AtosBrand compact /></span>}<strong className="text-2xl text-white">{viewer.currentChurch.name}</strong></div></div>
      <form action={updateChurchBranding} className="grid gap-6 p-6 sm:p-8">
        <label className="font-semibold">Cor principal<div className="mt-2 flex items-center gap-3"><input className="h-12 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-1" defaultValue={viewer.churchBranding.primaryColor} name="primaryColor" type="color" /><span className="text-sm font-normal text-[var(--muted)]">Usada nos destaques da igreja.</span></div></label>
        <label className="font-semibold">Logo da igreja<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm" name="logo" type="file" /><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Preferencialmente quadrado e com fundo transparente.</span></label>
        <label className="font-semibold">Foto de capa<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm" name="cover" type="file" /><span className="mt-1 block text-xs font-normal text-[var(--muted)]">Uma foto horizontal do templo, culto ou equipe.</span></label>
        <PendingSubmitButton className="min-h-13 rounded-xl bg-[var(--brand)] px-6 font-semibold text-white" pendingLabel="Salvando identidade...">Salvar personalização</PendingSubmitButton>
      </form>
    </section>
  </main>;
}
