import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import "react-easy-crop/react-easy-crop.css";
import { PwaRegister } from "@/shared/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "Kairos Escala", template: "%s · Kairos Escala" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  description: "Agenda de Times, Organização e Serviço.",
  applicationName: "Kairos Escala",
  verification: {
    google: "I2r2KI8I_165AskwKD0rpOXiD03U_DYkJgx9rYFcaTs",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kairos" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#003F87" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1e33" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning style={{ colorScheme: "light dark" }}>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('kairos-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()` }} /></head>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
