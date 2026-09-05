"use client";

import React from "react";

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export function GlowButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: GlowButtonProps) {
  const baseStyles =
    "relative inline-flex min-h-10 items-center justify-center font-bold rounded-xl px-4 py-2 text-xs sm:text-sm transition-all duration-200 overflow-hidden cursor-pointer select-none active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

  let variantStyles = "";
  if (variant === "primary") {
    variantStyles =
      "bg-gradient-to-r from-emerald-400 to-teal-300 text-slate-950 border border-emerald-200/40 shadow-sm shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-105";
  } else if (variant === "secondary") {
    variantStyles =
      "bg-slate-900/80 text-slate-200 border border-white/[0.08] hover:border-white/[0.18] hover:bg-slate-800/80 hover:text-white shadow-sm";
  } else if (variant === "danger") {
    variantStyles =
      "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white shadow-sm";
  } else if (variant === "ghost") {
    variantStyles =
      "bg-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]";
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}
