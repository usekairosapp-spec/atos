"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_EVENT = "kairos-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot() { return document.documentElement.classList.contains("dark"); }
function getServerSnapshot() { return false; }

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", !isDark);
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("kairos-theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return <button aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"} className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] transition hover:-translate-y-0.5" onClick={toggleTheme} type="button">{isDark ? <Sun size={19} /> : <Moon size={19} />}</button>;
}
