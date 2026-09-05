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
    "relative inline-flex min-h-10 items-center justify-center font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors duration-200 overflow-hidden cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";

  let variantStyles = "";
  if (variant === "primary") {
    variantStyles =
      "bg-emerald-300 text-emerald-950 border border-emerald-200/40 hover:bg-emerald-200";
  } else if (variant === "secondary") {
    variantStyles =
      "bg-slate-800/80 text-slate-200 border border-slate-700/80 hover:border-slate-600 hover:bg-slate-700/80 hover:text-white";
  } else if (variant === "danger") {
    variantStyles =
      "bg-rose-600 text-white border border-rose-500/30 hover:bg-rose-700";
  } else if (variant === "ghost") {
    variantStyles =
      "bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50";
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
