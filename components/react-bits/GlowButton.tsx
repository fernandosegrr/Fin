"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

const variants = {
  primary: "border-[#245C42] bg-[#245C42] text-white hover:bg-[#1D4C37]",
  secondary: "border-[#CBD8CC] bg-white text-[#254638] hover:bg-[#F1F6F0]",
  danger: "border-[#E4C7C1] bg-[#FCF0ED] text-[#A34D46] hover:bg-[#F7E4DF]",
  ghost: "border-transparent bg-transparent text-[#526A59] hover:bg-[#E9F0E7] hover:text-[#1C3028]",
} as const;

export function GlowButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: GlowButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-xs font-semibold transition-colors sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
