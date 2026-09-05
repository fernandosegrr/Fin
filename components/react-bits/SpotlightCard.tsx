"use client";

import React, { useRef } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.15)",
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    div.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    div.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  };

  const handleFocus = () => {
    divRef.current?.style.setProperty("--spot-opacity", "1");
  };

  const handleBlur = () => {
    divRef.current?.style.setProperty("--spot-opacity", "0");
  };

  const handleMouseEnter = () => {
    divRef.current?.style.setProperty("--spot-opacity", "1");
  };

  const handleMouseLeave = () => {
    divRef.current?.style.setProperty("--spot-opacity", "0");
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`finance-card relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 ${className}`}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500"
        style={{
          opacity: "var(--spot-opacity, 0)",
          background: `radial-gradient(600px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
