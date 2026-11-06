import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";

interface BrandLogoProps {
  variant?: "icon" | "compact" | "full" | "hero";
  className?: string;
  withGlow?: boolean;
  withLink?: boolean;
}

export function BrandLogo({ variant = "compact", className = "", withLink = false }: BrandLogoProps) {
  const content = <span className={`brand-logo brand-logo--${variant} ${className}`}>
    <span className="brand-mark" aria-hidden="true"><ChartNoAxesCombined size={22} strokeWidth={2} /></span>
    {variant !== "icon" && <span className="brand-wordmark">NexFin{(variant === "full" || variant === "hero") && <span>Finanzas personales</span>}</span>}
  </span>;
  return withLink ? <Link href="/dashboard" aria-label="NexFin · Ir al inicio" className="inline-flex rounded-lg">{content}</Link> : content;
}
