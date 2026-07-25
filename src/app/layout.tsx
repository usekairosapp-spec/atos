import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import "react-easy-crop/react-easy-crop.css";
import { PwaRegister } from "@/shared/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "ATOS", template: "%s · ATOS" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  description: "Agenda de Times, Organização e Serviço.",
  applicationName: "ATOS",
  verification: {
    google: "lCGIyVkbvIuiI5itTw4j-P4XxyD1JwVosJETE2YjOQo",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ATOS" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6827d8" },
    { media: "(prefers-color-scheme: dark)", color: "#100c2c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('atos-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()` }} /></head>
      <body><PwaRegister />{children}</body>
    </html>
  );
}
