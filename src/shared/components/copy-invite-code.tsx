"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-bold text-[var(--brand)]" onClick={async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }} type="button">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copiado" : "Copiar código"}</button>;
}
