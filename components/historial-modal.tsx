"use client";

import { useEffect, useState } from "react";
import { Search, X, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { buscarTransacciones } from "@/app/dashboard/actions";
import { formatearFechaCorta } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { MetodoPago, TipoCategoria, TransaccionConCategoria } from "@/lib/types";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

export function HistorialModal({ abierto, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<"todos" | TipoCategoria>("todos");
  const [metodo, setMetodo] = useState<"todos" | MetodoPago>("todos");
  const [filas, setFilas] = useState<TransaccionConCategoria[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(abierto, onCerrar);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    const t = setTimeout(() => {
      setCargando(true);
      setError(null);
      buscarTransacciones({ busqueda, tipo, metodoPago: metodo, limite: 50, offset: 0 })
        .then((r) => {
          if (cancelado) return;
          setFilas(r.filas);
          setTotal(r.total);
        })
        .catch((err) => {
          if (!cancelado) setError(err instanceof Error ? err.message : "No se pudo buscar.");
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [abierto, busqueda, tipo, metodo]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historial"
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl max-h-[88dvh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 id="titulo-historial" className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Search className="h-4 w-4 text-emerald-400" /> Historial
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1.5 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por descripción, categoría o cliente..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["todos", "egreso", "ingreso"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  tipo === t ? "bg-slate-800 text-white font-semibold" : "text-slate-400 bg-slate-950 border border-white/5"
                }`}
              >
                {t === "todos" ? "Todos" : t === "egreso" ? "Egresos" : "Ingresos"}
              </button>
            ))}
            {(["todos", "tarjeta", "efectivo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                className={`px-2.5 py-1 rounded-lg text-xs ${
                  metodo === m ? "bg-slate-800 text-white font-semibold" : "text-slate-400 bg-slate-950 border border-white/5"
                }`}
              >
                {m === "todos" ? "Cuentas" : m === "tarjeta" ? "Tarjeta" : "Efectivo"}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-2 text-[10px] text-slate-500">
          {cargando ? "Buscando…" : `${filas.length} de ${total} movimientos`}
        </p>

        <div className="mt-2 flex-1 overflow-y-auto space-y-1.5 pr-1">
          {error && (
            <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{error}</p>
          )}
          {cargando && filas.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          )}
          {!cargando && filas.length === 0 && !error && (
            <p className="py-8 text-center text-xs text-slate-500">No hay movimientos con esos filtros.</p>
          )}
          {filas.map((t) => {
            const esIngreso = t.categoria?.tipo === "ingreso";
            return (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/50 border border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                      esIngreso ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}
                  >
                    {esIngreso ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {t.categoria?.nombre ?? "Sin categoría"}
                      {t.cliente?.nombre ? ` · ${t.cliente.nombre}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {formatearFechaCorta(t.fecha)}
                      {t.descripcion ? ` · ${t.descripcion}` : ""}
                      {` · ${t.metodo_pago === "efectivo" ? "Efectivo" : "Tarjeta"}`}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums shrink-0 pl-2 ${esIngreso ? "text-emerald-400" : "text-slate-100"}`}>
                  {esIngreso ? "+" : "−"}
                  {formatearMonto(t.monto)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
