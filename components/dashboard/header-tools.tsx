"use client";

import { useEffect, useRef } from "react";
import { Ellipsis, LogOut, Search, Plus } from "lucide-react";
import { ExportButton } from "../export-button";
import { signOut } from "@/app/dashboard/actions";
import type { CuentaFinanciera } from "@/lib/finance/types";

export function HeaderTools({ anio, mes, nombreMes, cuentas, pendientes, onBuscar, onRevisar, onNuevo }: {
  anio: number; mes: number; nombreMes: string; cuentas?: CuentaFinanciera[]; pendientes: number;
  onBuscar: () => void; onRevisar: () => void; onNuevo?: () => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function fuera(e: PointerEvent) { if (e.target instanceof Node && !menu.current?.contains(e.target)) menu.current?.removeAttribute("open"); }
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, []);
  return <div className="header-actions">
    <div className={onNuevo ? "hidden sm:block" : ""}><button type="button" className="icon-button" aria-label="Buscar en todo el historial" title="Buscar en todo el historial" onClick={onBuscar}><Search size={19} /></button></div>
    <div className="hidden sm:block"><ExportButton {...{ anio, mes, nombreMes, cuentas }} /></div>
    {pendientes > 0 && <div className="hidden sm:block"><button type="button" onClick={onRevisar} className="finance-action" aria-label={`Revisar ${pendientes} movimientos`}>Por revisar <span className="review-count">{pendientes}</span></button></div>}
    {onNuevo && <button type="button" className="icon-button !bg-[#286F50] !text-white" aria-label="Agregar movimiento" title="Agregar movimiento" onClick={onNuevo}><Plus size={21} /></button>}
    <details ref={menu} className="header-tools" onKeyDown={e => { if (e.key === "Escape") { menu.current?.removeAttribute("open"); menu.current?.querySelector("summary")?.focus(); } }}>
      <summary aria-label="Más opciones" title="Más opciones" className="icon-button"><Ellipsis size={22} /></summary>
      <div className="header-tools-panel">
        <p>Tu cuenta</p>
        {onNuevo && <div className="sm:hidden"><button type="button" aria-label="Buscar en el historial" onClick={() => { menu.current?.removeAttribute("open"); onBuscar(); }}><Search size={17} /> Buscar en el historial</button></div>}
        <div className="sm:hidden"><ExportButton {...{ anio, mes, nombreMes, cuentas }} /></div>
        {pendientes > 0 && <div className="sm:hidden"><button type="button" aria-label={`Revisar ${pendientes} movimientos`} onClick={() => { menu.current?.removeAttribute("open"); onRevisar(); }}>Revisar movimientos <span className="review-count">{pendientes}</span></button></div>}
        <form action={signOut}><button type="submit" aria-label="Cerrar sesión"><LogOut size={17} /> Cerrar sesión</button></form>
      </div>
    </details>
  </div>;
}
