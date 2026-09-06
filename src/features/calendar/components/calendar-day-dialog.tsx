"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function CalendarDayDialog({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <dialog ref={dialog} aria-labelledby="calendar-day-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[2rem] border-0 bg-white p-0 text-[#172b3a] shadow-2xl backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-[2rem]">
    <header className="sticky top-0 z-10 rounded-t-[2rem] border-b border-[#e2e7ee] bg-white px-5 pb-4 pt-3 sm:px-7">
      <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#c6d0dc] sm:hidden" />
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[var(--church-brand)]">Escalas do dia</p><h2 id="calendar-day-title" className="mt-1 text-xl font-bold capitalize">{title}</h2></div><button autoFocus aria-label="Fechar escalas do dia" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[#f1f4f8]" onClick={close} type="button"><X /></button></div>
    </header>
    <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-7">{children}</div>
  </dialog>;
}
