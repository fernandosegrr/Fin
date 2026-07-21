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
    "relative inline-flex items-center justify-center font-medium rounded-2xl px-5 py-2.5 text-sm transition-all duration-200 overflow-hidden cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  let variantStyles = "";
  if (variant === "primary") {
    variantStyles =
      "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 border border-emerald-400/30 hover:border-emerald-400/60";
  } else if (variant === "secondary") {
    variantStyles =
      "bg-slate-800/80 text-slate-200 border border-slate-700/80 hover:border-slate-600 hover:bg-slate-700/80 hover:text-white";
  } else if (variant === "danger") {
    variantStyles =
      "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/20 hover:shadow-rose-600/35 border border-rose-500/30 hover:border-rose-400/60";
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
