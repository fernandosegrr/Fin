"use client";

import { ChevronLeft, ChevronRight, Calendar, RotateCcw } from "lucide-react";
import { capitalizarPrimeraLetra } from "@/lib/format";
import { hoyEnMexico, nombreDelMes } from "@/lib/dates";

interface MonthSelectorProps {
  anio: number;
  mes: number; // 1-12
  onCambiarMes: (nuevoAnio: number, nuevoMes: number) => void;
}

export function MonthSelector({ anio, mes, onCambiarMes }: MonthSelectorProps) {
  const hoy = hoyEnMexico();
  const esMesActual = anio === hoy.anio && mes === hoy.mes;

  function irAnterior() {
    if (mes === 1) {
      onCambiarMes(anio - 1, 12);
    } else {
      onCambiarMes(anio, mes - 1);
    }
  }

  function irSiguiente() {
    if (mes === 12) {
      onCambiarMes(anio + 1, 1);
    } else {
      onCambiarMes(anio, mes + 1);
    }
  }

  function irMesActual() {
    onCambiarMes(hoy.anio, hoy.mes);
  }

  const nombreMesCapitalizado = capitalizarPrimeraLetra(nombreDelMes(anio, mes));

  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#DCE4DB] bg-white/85 p-1.5 backdrop-blur-2xl shadow-lg shadow-black/5">
      <button
        type="button"
        disabled={anio <= 2000 && mes === 1}
        onClick={irAnterior}
        aria-label="Mes anterior"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE4DB] bg-[#F4F7F2] text-[#475C50] transition-all hover:border-[#CBD6CA] hover:bg-white/[0.08] hover:text-[#1C3028] active:scale-95 disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-[#286F50]">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs sm:text-sm font-bold tracking-wide text-[#1C3028] truncate">
          {nombreMesCapitalizado}
        </span>

        {!esMesActual && (
          <button
            type="button"
            onClick={irMesActual}
            className="ml-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-[#286F50] hover:bg-emerald-500/20 hover:text-[#1C3028] transition-all shadow-sm"
            title="Volver al mes actual"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Hoy
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={anio >= 2100 && mes === 12}
        onClick={irSiguiente}
        aria-label="Mes siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE4DB] bg-[#F4F7F2] text-[#475C50] transition-all hover:border-[#CBD6CA] hover:bg-white/[0.08] hover:text-[#1C3028] active:scale-95 disabled:opacity-30 disabled:pointer-events-none shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
