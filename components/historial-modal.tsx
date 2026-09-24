"use client";

import { Search, X, Loader2, ArrowUpRight, ArrowDownRight, ArrowRightLeft } from "lucide-react";
import { formatearFechaCorta } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import type { MetodoPago } from "@/lib/types";
import { useHistorySearch } from "./history/use-history-search";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

export function HistorialModal({ abierto, onCerrar }: Props) {
  const {
    busqueda, setBusqueda, tipo, setTipo, metodo, setMetodo, cargando, cargandoMas, error,
    totalGeneral, hayMas, items, cargarMas,
  } = useHistorySearch(abierto, onCerrar);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#14251D]/45 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historial"
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#DCE4DB] bg-white p-6 shadow-2xl backdrop-blur-2xl max-h-[88dvh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-[#DCE4DB]">
          <h2 id="titulo-historial" className="text-base font-black text-[#1C3028] flex items-center gap-2">
            <Search className="h-4 w-4 text-[#286F50]" /> Historial Completo
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-xl p-1.5 text-[#5E7165] hover:bg-[#F4F7F2] hover:text-[#1C3028] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#5E7165]" />
            <input
              autoFocus
              aria-label="Buscar en el historial"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por descripción, categoría o cliente..."
              className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] pl-10 pr-4 py-2.5 text-xs text-[#1C3028] placeholder:text-[#7A897D] focus:border-emerald-400/50 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl bg-[#F7F9F5] p-1 border border-[#DCE4DB] text-xs font-bold">
              {(["todos", "egreso", "ingreso"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    tipo === t
                      ? "bg-[#E8EEE7] text-[#1C3028] shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  {t === "todos" ? "Todos" : t === "egreso" ? "Egresos" : "Ingresos"}
                </button>
              ))}
            </div>

            <div className="flex rounded-xl bg-[#F7F9F5] p-1 border border-[#DCE4DB] text-xs font-bold">
              {(["todos", "tarjeta", "efectivo"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    metodo === m
                      ? "bg-[#E8EEE7] text-[#1C3028] shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  {m === "todos" ? "Cuentas" : m === "tarjeta" ? "Tarjeta" : "Efectivo"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-[#7A897D]">
          {cargando ? "Buscando…" : `${items.length} de ${totalGeneral} movimientos`}
        </p>

        <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1">
          {error && (
            <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-[#AA524A]">{error}</p>
          )}
          {cargando && items.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#7A897D]" />
            </div>
          )}
          {!cargando && items.length === 0 && !error && (
            <p className="py-8 text-center text-xs text-[#7A897D]">No hay movimientos con esos filtros.</p>
          )}
          {items.map((item) => {
            if (item.clase === "transferencia") {
              const t = item.data;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F7F9F5] border border-indigo-500/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-indigo-500/10 border-indigo-500/20 text-[#62688B]">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#263D33] truncate">
                        Traspaso: {NOMBRE_METODO[t.origen]} → {NOMBRE_METODO[t.destino]}
                      </p>
                      <p className="text-[10px] text-[#7A897D] truncate">
                        {formatearFechaCorta(t.fecha)}
                        {t.descripcion ? ` · ${t.descripcion}` : ""}
                        {" · edítalo o bórralo desde \"Transferir\""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0 pl-2 text-[#62688B]">
                    {formatearMonto(t.monto)}
                  </span>
                </div>
              );
            }

            const t = item.data;
            const esIngreso = t.categoria?.tipo === "ingreso";
            return (
              <div key={item.key} className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB]">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                      esIngreso ? "bg-emerald-500/10 border-emerald-500/20 text-[#286F50]" : "bg-rose-500/10 border-rose-500/20 text-[#AA524A]"
                    }`}
                  >
                    {esIngreso ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#263D33] truncate">
                      {t.categoria?.nombre ?? "Sin categoría"}
                      {t.cliente?.nombre ? ` · ${t.cliente.nombre}` : ""}
                    </p>
                    <p className="text-[10px] text-[#7A897D] truncate">
                      {formatearFechaCorta(t.fecha)}
                      {t.descripcion ? ` · ${t.descripcion}` : ""}
                      {` · ${t.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta"}`}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 pl-2 ${esIngreso ? "text-[#286F50]" : "text-[#1C3028]"}`}>
                  {esIngreso ? "+" : "−"}
                  {formatearMonto(t.monto)}
                </span>
              </div>
            );
          })}
          {hayMas && (
            <div className="pt-2 pb-1 text-center">
              <button
                type="button"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#E8EEE7] hover:bg-[#E8EEE7] border border-[#DCE4DB] text-xs font-bold text-[#263D33] hover:text-[#1C3028] transition-all disabled:opacity-50 shadow-sm"
              >
                {cargandoMas && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {cargandoMas ? "Cargando más..." : "Cargar más movimientos"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
