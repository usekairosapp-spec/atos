import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kairos Escala — Agenda de Times, Organização e Serviço",
    short_name: "Kairos",
    description: "Escalas, equipes e organização do serviço da sua igreja.",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#f5f8fc",
    theme_color: "#003F87",
    orientation: "portrait-primary",
    lang: "pt-BR",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
