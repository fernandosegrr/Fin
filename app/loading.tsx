import { BrandLogo } from "@/components/brand-logo";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F4F6F0] px-4">
      <div className="flex flex-col items-center gap-5">
        <BrandLogo variant="hero" />
        <div className="h-1 w-44 overflow-hidden rounded-full bg-[#DCE4DB]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#245C42]" />
        </div>
        <p className="text-xs font-medium text-[#5E7165]">Preparando tu espacio…</p>
      </div>
    </main>
  );
}
