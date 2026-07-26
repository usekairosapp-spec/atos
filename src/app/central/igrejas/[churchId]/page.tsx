import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { updateChurchBrandingFromCentral } from "@/features/churches/branding-actions";
import { createClient } from "@/lib/supabase/server";
import { AuthMessage } from "@/shared/components/auth-message";
import { KairosBrand } from "@/shared/components/kairos-brand";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

type PageProps = { params: Promise<{ churchId: string }>; searchParams: Promise<{ erro?: string; sucesso?: string }> };

export default async function CentralChurchBrandingPage({ params, searchParams }: PageProps) {
  const [{ churchId }, message] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("id, name, logo_path, cover_path, primary_color").eq("id", churchId).maybeSingle();
  if (!church) notFound();
  const logoUrl = church.logo_path ? supabase.storage.from("church-branding").getPublicUrl(church.logo_path).data.publicUrl : null;
  const coverUrl = church.cover_path ? supabase.storage.from("church-branding").getPublicUrl(church.cover_path).data.publicUrl : null;

  return <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8"><Link className="inline-flex items-center gap-2 font-semibold text-[var(--brand)]" href="/central/igrejas"><ArrowLeft size={18} />Voltar para igrejas</Link><p className="mt-7 text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Identidade visual</p><h1 className="mt-2 text-3xl font-bold">{church.name}</h1><AuthMessage {...message} />
    <section className="premium-card mt-7 overflow-hidden rounded-[2rem]"><div className="relative h-56 bg-[linear-gradient(135deg,var(--church-color),#11222d)]" style={{ "--church-color": church.primary_color } as React.CSSProperties}>{coverUrl ? <Image alt={`Capa de ${church.name}`} className="object-cover opacity-75" fill sizes="1000px" src={coverUrl} unoptimized /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" /><div className="absolute bottom-6 left-6 flex items-center gap-4">{logoUrl ? <Image alt={`Logo de ${church.name}`} className="h-20 w-20 rounded-2xl bg-white object-contain p-1" height={80} src={logoUrl} width={80} unoptimized /> : <span className="rounded-2xl bg-white p-3"><KairosBrand compact /></span>}<strong className="text-2xl text-white">{church.name}</strong></div></div>
      <form action={updateChurchBrandingFromCentral} className="grid gap-6 p-6 sm:p-8"><input name="churchId" type="hidden" value={church.id} /><label className="font-semibold">Cor principal<div className="mt-2 flex items-center gap-3"><input className="h-12 w-16 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-1" defaultValue={church.primary_color} name="primaryColor" type="color" /><span className="text-sm font-normal text-[var(--muted)]">Cor dos destaques desta igreja.</span></div></label><label className="font-semibold">Logo<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm" name="logo" type="file" /></label><label className="font-semibold">Foto de capa<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm" name="cover" type="file" /></label><PendingSubmitButton className="min-h-13 rounded-xl bg-[var(--brand)] px-6 font-semibold text-white" pendingLabel="Salvando...">Salvar identidade da igreja</PendingSubmitButton></form>
    </section></main>;
}
