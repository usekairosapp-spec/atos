"use client";

import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
  };

  return (
    <Link
      className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#6827d8] px-5 font-semibold text-white shadow-lg hover:bg-[#5720bd] disabled:cursor-wait disabled:opacity-70"
      href="/auth/google"
      onClick={handleClick}
      aria-disabled={isLoading}
      style={{ pointerEvents: isLoading ? "none" : "auto", opacity: isLoading ? 0.7 : 1 }}
    >
      {isLoading ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          Carregando...
        </>
      ) : (
        "Continuar com Google"
      )}
    </Link>
  );
}
