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
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111726]/90 p-1.5 backdrop-blur-xl shadow-xl">
      <button
        type="button"
        disabled={anio <= 2000 && mes === 1}
        onClick={irAnterior}
        aria-label="Mes anterior"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-800/80 text-slate-300 transition-all hover:border-white/20 hover:bg-slate-700 hover:text-white active:scale-95 shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 px-2 py-1">
        <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-100 truncate">
          {nombreMesCapitalizado}
        </span>

        {!esMesActual && (
          <button
            type="button"
            onClick={irMesActual}
            className="ml-1 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all"
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
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-800/80 text-slate-300 transition-all hover:border-white/20 hover:bg-slate-700 hover:text-white active:scale-95 shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
