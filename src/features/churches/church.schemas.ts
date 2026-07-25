import { z } from "zod";

export const createChurchSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da igreja.").max(120),
});

export function createSlug(name: string) {
  return `${name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
}
