"use client";

import type { ButtonHTMLAttributes } from "react";
import { PendingSubmitButton } from "@/shared/components/pending-submit-button";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmation: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({ confirmation, onClick, ...props }: ConfirmSubmitButtonProps) {
  return <PendingSubmitButton
    {...props}
    onClick={(event) => {
      onClick?.(event);
      if (!event.defaultPrevented && !window.confirm(confirmation)) event.preventDefault();
    }}
  />;
}
