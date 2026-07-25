import Image from "next/image";

export function AtosBrand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return <span className="inline-flex items-center">
    {compact
      ? <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#28133f] p-1.5 shadow-[0_7px_18px_rgba(80,38,137,.24)]"><Image alt="ATOS" className="h-full w-full object-contain" height={38} priority src="/brand/atos-icon-transparent.png" width={38} /></span>
      : <span className={`inline-flex flex-col rounded-xl px-3 py-2 ${light ? "bg-white/8 ring-1 ring-white/10" : "bg-[#28133f] shadow-md"}`}>
        <Image alt="ATOS" className="h-auto w-40 object-contain sm:w-44" height={76} priority src="/brand/atos-logo-transparent.png" width={176} />
        <small className={`mt-1 text-center text-[8px] font-semibold uppercase tracking-[.09em] ${light ? "text-white/65" : "text-violet-100/75"}`}>Agenda de Times, Organização e Serviço</small>
      </span>}
  </span>;
}
