"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string };

export function PendingSubmitButton({ children, className = "", disabled, pendingLabel = "Salvando...", ...props }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  return <button {...props} aria-disabled={disabled || pending} className={`${className} disabled:cursor-wait disabled:opacity-70`} disabled={disabled || pending}>{pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" size={18} />{pendingLabel}</> : children}</button>;
}
