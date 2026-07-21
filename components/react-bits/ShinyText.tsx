"use client";

import React from "react";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export function ShinyText({ text, disabled = false, speed = 5, className = "" }: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`inline-block bg-gradient-to-r from-emerald-400 via-teal-200 to-indigo-400 bg-clip-text text-transparent ${
        disabled ? "" : "animate-shiny"
      } ${className}`}
      style={{
        backgroundSize: "200% 100%",
        animationDuration,
      }}
    >
      {text}
    </span>
  );
}
