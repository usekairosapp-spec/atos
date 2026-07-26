"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";
import { getViewerContext } from "@/features/auth/viewer";
import { createClient } from "@/lib/supabase/server";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Copia os bytes para um ArrayBuffer isolado: o buffer devolvido pelo sharp/Node
// pode vir do pool interno do Buffer, que em runtimes serverless às vezes é
// backed por SharedArrayBuffer — e o fetch usado pelo supabase-js rejeita
// corpos de upload apoiados em SharedArrayBuffer ("SharedArrayBuffer is not allowed").
function toPlainUint8Array(buffer: Buffer): Uint8Array {
  const copy = new Uint8Array(buffer.length);
  copy.set(buffer);
  return copy;
}

async function optimizeImage(value: FormDataEntryValue | null, kind: "logo" | "cover") {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type) || value.size > 5 * 1024 * 1024) throw new Error("Use uma imagem JPG, PNG ou WebP de até 5 MB.");
  const source = sharp(Buffer.from(await value.arrayBuffer())).rotate();
  const buffer = await (kind === "logo"
    ? source.resize(800, 800, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer()
    : source.resize(1800, 900, { fit: "cover", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer());
  return toPlainUint8Array(buffer);
}

export async function updateChurchBranding(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer?.currentChurch || !viewer.isChurchAdmin) redirect("/painel?erro=Sem permissão para personalizar a igreja.");
  const color = colorSchema.safeParse(formData.get("primaryColor"));
  if (!color.success) redirect("/painel/igreja?erro=Escolha uma cor principal válida.");
  const textColor = colorSchema.safeParse(formData.get("secondaryColor"));
  if (!textColor.success) redirect("/painel/igreja?erro=Escolha uma cor de texto/legenda válida.");
  const supabase = await createClient();

  let logo: Uint8Array | null = null;
  let cover: Uint8Array | null = null;
  try {
    [logo, cover] = await Promise.all([optimizeImage(formData.get("logo"), "logo"), optimizeImage(formData.get("cover"), "cover")]);
  } catch (error) {
    redirect(`/painel/igreja?erro=${encodeURIComponent(error instanceof Error ? error.message : "Imagem inválida.")}`);
  }

  const churchId = viewer.currentChurch.id;
  const version = Date.now();
  const logoPath = logo ? `${churchId}/logo-${version}.webp` : null;
  const coverPath = cover ? `${churchId}/cover-${version}.webp` : null;
  if (logo) {
    const { error: uploadError } = await supabase.storage.from("church-branding").upload(logoPath!, logo, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploadError) redirect(`/painel/igreja?erro=${encodeURIComponent(`Não foi possível salvar o logo: ${uploadError.message}`)}`);
  }
  if (cover) {
    const { error: uploadError } = await supabase.storage.from("church-branding").upload(coverPath!, cover, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploadError) redirect(`/painel/igreja?erro=${encodeURIComponent(`Não foi possível salvar a capa: ${uploadError.message}`)}`);
  }

  const { error } = await supabase.rpc("update_church_branding", { target_church_id: churchId, target_primary_color: color.data, target_logo_path: logoPath, target_cover_path: coverPath, target_secondary_color: textColor.data });
  if (error) redirect(`/painel/igreja?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel", "layout");
  redirect("/painel/igreja?sucesso=Identidade visual atualizada.");
}

export async function updateChurchBrandingFromCentral(formData: FormData) {
  const viewer = await getViewerContext();
  const parsed = z.object({ churchId: z.string().uuid(), primaryColor: colorSchema, secondaryColor: colorSchema }).safeParse(Object.fromEntries(formData));
  if (!viewer?.isPlatformAdmin || !parsed.success) redirect("/central?erro=Personalização inválida.");
  const supabase = await createClient();

  let logo: Uint8Array | null = null;
  let cover: Uint8Array | null = null;
  try {
    [logo, cover] = await Promise.all([optimizeImage(formData.get("logo"), "logo"), optimizeImage(formData.get("cover"), "cover")]);
  } catch (error) {
    redirect(`/central/igrejas/${parsed.data.churchId}?erro=${encodeURIComponent(error instanceof Error ? error.message : "Imagem inválida.")}`);
  }

  const version = Date.now();
  const logoPath = logo ? `${parsed.data.churchId}/logo-${version}.webp` : null;
  const coverPath = cover ? `${parsed.data.churchId}/cover-${version}.webp` : null;
  if (logo) {
    const { error: uploadError } = await supabase.storage.from("church-branding").upload(logoPath!, logo, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploadError) redirect(`/central/igrejas/${parsed.data.churchId}?erro=${encodeURIComponent(`Não foi possível salvar o logo: ${uploadError.message}`)}`);
  }
  if (cover) {
    const { error: uploadError } = await supabase.storage.from("church-branding").upload(coverPath!, cover, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploadError) redirect(`/central/igrejas/${parsed.data.churchId}?erro=${encodeURIComponent(`Não foi possível salvar a capa: ${uploadError.message}`)}`);
  }

  const { error } = await supabase.rpc("update_church_branding", { target_church_id: parsed.data.churchId, target_primary_color: parsed.data.primaryColor, target_logo_path: logoPath, target_cover_path: coverPath, target_secondary_color: parsed.data.secondaryColor });
  if (error) redirect(`/central/igrejas/${parsed.data.churchId}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/central");
  revalidatePath("/painel", "layout");
  redirect(`/central/igrejas/${parsed.data.churchId}?sucesso=Identidade visual atualizada.`);
}
