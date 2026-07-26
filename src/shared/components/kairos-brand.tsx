import Image from "next/image";

export function KairosBrand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return <span className="inline-flex items-center">
    {compact
      ? <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#00294f] p-1.5 shadow-[0_7px_18px_rgba(0,63,135,.28)]"><Image alt="Kairos" className="h-full w-full object-contain" height={38} priority src="/brand/kairos-icon-transparent.png" width={38} /></span>
      : <span className={`inline-flex flex-col rounded-xl px-3 py-2 ${light ? "bg-white/8 ring-1 ring-white/10" : "bg-[#00294f] shadow-md"}`}>
        <Image alt="Kairos" className="h-auto w-40 object-contain sm:w-44" height={76} priority src="/brand/kairos-logo-transparent.png" width={176} />
      </span>}
  </span>;
}
