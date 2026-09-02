import { useEffect } from "react";

/** Cierra un modal con la tecla Escape mientras está abierto. */
export function useEscapeKey(activo: boolean, alCerrar: () => void): void {
  useEffect(() => {
    if (!activo) return;

    function manejarTecla(e: KeyboardEvent) {
      if (e.key === "Escape") alCerrar();
    }

    document.addEventListener("keydown", manejarTecla);
    return () => document.removeEventListener("keydown", manejarTecla);
  }, [activo, alCerrar]);
}
