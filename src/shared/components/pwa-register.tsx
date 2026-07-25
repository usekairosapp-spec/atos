"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let refreshing = false;
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", refresh);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      registration.update();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {
      // O site continua funcional quando o navegador bloqueia o PWA.
    });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", refresh);
  }, []);

  return null;
}
