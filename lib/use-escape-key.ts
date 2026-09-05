import { useEffect, useRef } from "react";

const modales = new Set<symbol>();
let overflowAnterior = "";
const seleccionables = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Cierra un modal con la tecla Escape mientras está abierto. */
export function useEscapeKey(activo: boolean, alCerrar: () => void): void {
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;
  useEffect(() => {
    if (!activo) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const id = Symbol();
    if (modales.size === 0) {
      overflowAnterior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modales.add(id);
    let dialogo: HTMLElement | null = null;
    function ultimoDialogo() {
      return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(el => el.getClientRects().length > 0).at(-1) ?? null;
    }
    const frame = requestAnimationFrame(() => {
      dialogo = ultimoDialogo();
      if (!dialogo || dialogo.contains(document.activeElement)) return;
      const objetivo = dialogo.querySelector<HTMLElement>(seleccionables);
      if (objetivo) objetivo.focus();
      else { dialogo.tabIndex = -1; dialogo.focus(); }
    });

    function manejarTecla(e: KeyboardEvent) {
      if (!dialogo || dialogo !== ultimoDialogo()) return;
      if (e.key === "Escape") { e.preventDefault(); cerrarRef.current(); }
      if (e.key === "Tab") {
        const elementos = Array.from(dialogo.querySelectorAll<HTMLElement>(seleccionables)).filter(el => el.getClientRects().length > 0);
        const primero = elementos[0], ultimo = elementos.at(-1);
        if (!primero || !ultimo) { e.preventDefault(); dialogo.focus(); return; }
        if (e.shiftKey && (document.activeElement === primero || !dialogo.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && (document.activeElement === ultimo || !dialogo.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
      }
    }

    document.addEventListener("keydown", manejarTecla);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", manejarTecla);
      modales.delete(id);
      if (modales.size === 0) document.body.style.overflow = overflowAnterior;
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
  }, [activo]);
}
