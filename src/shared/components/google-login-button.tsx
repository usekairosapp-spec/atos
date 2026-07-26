"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsLoading(true);
    window.location.href = "/auth/google";
  };

  return (
    <button
      className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#277ad8] px-5 font-semibold text-white shadow-lg hover:bg-[#206cbd] disabled:cursor-wait disabled:opacity-70"
      onClick={handleClick}
      disabled={isLoading}
      aria-disabled={isLoading}
      type="button"
    >
      {isLoading ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" size={18} />
          Carregando...
        </>
      ) : (
        "Continuar com Google"
      )}
    </button>
  );
}
