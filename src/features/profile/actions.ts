"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome.").max(120),
  phone: z.string().trim().max(30).optional(),
});

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({ fullName: formData.get("fullName"), phone: formData.get("phone") });
  if (!parsed.success) redirect(`/painel/perfil?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const avatar = formData.get("avatar");
  let avatarPath: string | undefined;
  if (avatar instanceof File && avatar.size > 0) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(avatar.type) || avatar.size > 5 * 1024 * 1024) {
      redirect("/painel/perfil?erro=A foto deve ser JPG, PNG ou WebP e ter no máximo 5 MB.");
    }
    let optimizedAvatar: Buffer;
    try {
      const rotated = await sharp(Buffer.from(await avatar.arrayBuffer())).rotate().toBuffer({ resolveWithObject: true });
      const cropValues = ["cropX", "cropY", "cropWidth", "cropHeight"].map((key) => Number(formData.get(key)));
      const [cropX, cropY, cropWidth, cropHeight] = cropValues;
      let image = sharp(rotated.data);
      if (cropValues.every(Number.isFinite) && cropWidth && cropHeight) {
        const left = Math.max(0, Math.min(Math.floor(cropX ?? 0), rotated.info.width - 1));
        const top = Math.max(0, Math.min(Math.floor(cropY ?? 0), rotated.info.height - 1));
        const width = Math.max(1, Math.min(Math.floor(cropWidth), rotated.info.width - left));
        const height = Math.max(1, Math.min(Math.floor(cropHeight), rotated.info.height - top));
        image = image.extract({ left, top, width, height });
      }
      optimizedAvatar = await image.resize(800, 800, { fit: "cover", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch {
      redirect("/painel/perfil?erro=Não foi possível processar esta imagem.");
    }
    avatarPath = `${user.id}/avatar.webp`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(avatarPath, optimizedAvatar, { contentType: "image/webp", upsert: true });
    if (uploadError) redirect("/painel/perfil?erro=Não foi possível enviar a foto.");
  }

  const updates: { full_name: string; phone?: string; avatar_path?: string } = {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
  };
  if (avatarPath) updates.avatar_path = avatarPath;
  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) redirect("/painel/perfil?erro=Não foi possível atualizar o perfil.");

  revalidatePath("/painel", "layout");
  redirect("/painel/perfil?sucesso=Perfil atualizado.");
}
