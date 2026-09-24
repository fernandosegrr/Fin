"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "#dce4db",
  style,
  ...props
}: SpotlightCardProps) {
  return (
    <div
      className={`finance-card relative overflow-hidden ${className}`}
      style={{ ...style, borderTopColor: spotlightColor }}
      {...props}
    >
      {children}
    </div>
  );
}
