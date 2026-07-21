"use client";

import { useEffect, useState } from "react";
import { useSpring } from "framer-motion";
import { formatearMonto } from "@/lib/format";

interface Props {
  value: number;
  className?: string;
}

export function AnimatedNumber({ value, className = "" }: Props) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const [displayValue, setDisplayValue] = useState(formatearMonto(value));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplayValue(formatearMonto(latest));
    });
    return () => unsubscribe();
  }, [spring]);

  return <span className={className}>{displayValue}</span>;
}
