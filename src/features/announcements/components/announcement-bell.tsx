"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

export function AnnouncementBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  useEffect(() => {
    const update = async () => { try { const response = await fetch("/api/comunicados/nao-lidos", { cache: "no-store" }); if (response.ok) { const result = await response.json() as { count: number }; setCount(result.count); } } catch {} };
    void update();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void update(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  return <Link aria-label={`Comunicados${count ? `, ${count} não lidos` : ""}`} className="relative p-1" href="/painel/comunicados"><Megaphone size={22} />{count ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count > 9 ? "9+" : count}</span> : null}</Link>;
}
