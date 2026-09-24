"use client";

import { Search, Plus, Layers, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatearFechaCorta } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import type { Categoria, Cliente, TransaccionConCategoria } from "@/lib/types";
import { TransactionCaptureModal } from "./transaction-capture-modal";
import { CategoryManagerModal } from "./category-manager-modal";
import { useTransactions } from "./transactions/use-transactions";

interface Props {
  initialTransacciones: TransaccionConCategoria[];
  /** Total real de movimientos del mes en la BD (puede ser mayor a `initialTransacciones.length`, que está limitado a 200). */
  totalTransacciones: number;
  categorias: Categoria[];
  clientes?: Cliente[];
  onTransaccionCambiada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export function TransactionsSection({
  initialTransacciones,
  totalTransacciones,
  categorias,
  clientes = [],
  onTransaccionCambiada,
}: Props) {
  const {
    modalCapturaAbierto, setModalCapturaAbierto, modalCategoriasAbierto, setModalCategoriasAbierto,
    transaccionAEditar, busqueda, setBusqueda, filtroTipo, setFiltroTipo, filtroMetodo, setFiltroMetodo,
    errorEnvio, transacciones, transaccionesFiltradas, manejarEnvio, manejarEliminar, abrirEdicion, abrirNuevo,
  } = useTransactions({ initialTransacciones, categorias, clientes, onTransaccionCambiada });

  return (
    <>
      <section className="mt-4 px-0 sm:px-4 pb-20">
        <SpotlightCard
          spotlightColor="rgba(16, 244, 177, 0.12)"
          className="bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950/90 border border-white/[0.08] p-5 sm:p-6 rounded-3xl shadow-xl shadow-black/30"
        >
          {/* Controls Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                Movimientos del Mes
              </h2>
              <p className="text-xs text-slate-400">
                Mostrando {transaccionesFiltradas.length} de {transacciones.length} transacciones registradas
              </p>
            </div>

            <div className="flex items-center gap-2">
              <GlowButton
                variant="secondary"
                onClick={() => setModalCategoriasAbierto(true)}
                className="!py-1.5 !px-3 !text-xs"
              >
                <Layers className="h-3.5 w-3.5" />
                Categorías
              </GlowButton>
              <GlowButton
                variant="primary"
                onClick={abrirNuevo}
                className="!py-1.5 !px-3.5 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </GlowButton>
            </div>
          </div>

          {/* Bar de búsqueda y Filtros */}
          <div className="space-y-3 mb-5">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                aria-label="Buscar movimientos del mes"
                placeholder="Buscar por concepto, categoría o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.08] bg-slate-950/80 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Chips de filtro */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroTipo("todos")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "todos"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("egreso")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "egreso"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Egresos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("ingreso")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "ingreso"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Ingresos
                </button>
              </div>

              {/* Filtro por Método de Pago */}
              <div className="flex rounded-xl bg-slate-950/80 p-1 border border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("todos")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "todos"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todas las cuentas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("tarjeta")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "tarjeta"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  💳 Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("efectivo")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "efectivo"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  💵 Efectivo
                </button>
              </div>
            </div>
          </div>

          {errorEnvio && (
            <p className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs text-rose-400">
              {errorEnvio}
            </p>
          )}

          {totalTransacciones > transacciones.length && (
            <p className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-xs text-amber-400">
              Mostrando los {transacciones.length} movimientos más recientes de {totalTransacciones} este mes. Usa
              &quot;Exportar Excel&quot; para descargar el mes completo.
            </p>
          )}

          {/* Lista de transacciones */}
          {transaccionesFiltradas.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-500">
              {transacciones.length === 0
                ? "Todavía no hay movimientos registrados en este mes."
                : "No se encontraron movimientos con los filtros aplicados."}
            </div>
          ) : (
            <div className="space-y-2">
              {transaccionesFiltradas.map((t) => {
                const esIngreso = t.categoria?.tipo === "ingreso";
                const esEfectivo = t.metodo_pago === "efectivo";

                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.pendiente}
                    onClick={() => {
                      abrirEdicion(t);
                    }}
                    className={`group flex w-full items-center justify-between p-3.5 text-left rounded-2xl bg-slate-950/50 border border-white/[0.05] hover:border-white/[0.15] hover:bg-slate-900/60 transition-all ${
                      t.pendiente ? "opacity-50 cursor-wait" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                          esIngreso
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                        }`}
                      >
                        {esIngreso ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="truncate text-xs sm:text-sm font-bold text-slate-200">
                            {t.categoria?.nombre ?? "Sin categoría"}
                            {t.cliente?.nombre ? (
                              <span className="ml-1 font-medium text-slate-400">· {t.cliente.nombre}</span>
                            ) : null}
                          </p>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                              esEfectivo
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                            }`}
                          >
                            {esEfectivo ? "Efectivo" : "Tarjeta"}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-slate-400 mt-0.5">
                          {formatearFechaCorta(t.fecha)}
                          {t.descripcion ? ` · ${t.descripcion}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 pl-3">
                      <span
                        className={`text-sm sm:text-base font-black tabular-nums ${
                          esIngreso ? "text-emerald-400" : "text-slate-100"
                        }`}
                      >
                        {esIngreso ? "+" : "−"}
                        {formatearMonto(t.monto)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SpotlightCard>
      </section>

      {/* Floating Action Button (FAB) neón */}
      <button
        type="button"
        onClick={abrirNuevo}
        aria-label="Agregar movimiento"
        className="lg:hidden fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 text-slate-950 font-black shadow-[0_0_24px_rgba(16,244,177,0.5)] hover:scale-105 active:scale-95 transition-all border border-emerald-200/50"
        style={{
          bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          right: "max(1.25rem, calc((100vw - 640px) / 2 + 1.25rem))",
        }}
      >
        <Plus className="h-7 w-7 text-slate-950" />
      </button>

      {/* Modales */}
      <TransactionCaptureModal
        onCategoriasCambiadas={onTransaccionCambiada}
        categorias={categorias}
        clientes={clientes}
        abierto={modalCapturaAbierto}
        transaccionEditar={transaccionAEditar}
        onCerrar={() => setModalCapturaAbierto(false)}
        onEnviar={manejarEnvio}
        onEliminar={manejarEliminar}
      />

      <CategoryManagerModal
        onCambio={onTransaccionCambiada}
        categorias={categorias}
        abierto={modalCategoriasAbierto}
        onCerrar={() => setModalCategoriasAbierto(false)}
      />
    </>
  );
}
