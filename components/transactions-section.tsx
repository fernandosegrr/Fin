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
import type { CuentaFinanciera } from "@/lib/finance/types";
import { naturalezaDe, signoMovimiento } from "@/lib/finance/ledger";
import { NOMBRES_NATURALEZA } from "@/lib/finance/types";
import { useEffect, useState } from "react";

interface Props {
  initialTransacciones: TransaccionConCategoria[];
  /** Total real de movimientos del mes en la BD (puede ser mayor a `initialTransacciones.length`, que está limitado a 200). */
  totalTransacciones: number;
  categorias: Categoria[];
  clientes?: Cliente[];
  cuentas?: CuentaFinanciera[];
  onTransaccionCambiada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

export function TransactionsSection({
  initialTransacciones,
  totalTransacciones,
  categorias,
  clientes = [],
  cuentas = [],
  onTransaccionCambiada,
}: Props) {
  const {
    modalCapturaAbierto, setModalCapturaAbierto, modalCategoriasAbierto, setModalCategoriasAbierto,
    transaccionAEditar, busqueda, setBusqueda, filtroTipo, setFiltroTipo, filtroMetodo, setFiltroMetodo,
    errorEnvio, transacciones, transaccionesFiltradas, manejarEnvio, manejarEliminar, abrirEdicion, abrirNuevo,
  } = useTransactions({ initialTransacciones, categorias, clientes, onTransaccionCambiada });
  const [limiteVisible, setLimiteVisible] = useState(50);
  useEffect(() => setLimiteVisible(50), [busqueda, filtroTipo, filtroMetodo]);

  return (
    <>
      <section className="mt-4 pb-8">
        <SpotlightCard
          spotlightColor="rgba(16, 244, 177, 0.12)"
          className="bg-white border border-[#DCE4DB] p-5 sm:p-6 rounded-3xl shadow-xl shadow-black/5"
        >
          {/* Controls Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#1C3028] tracking-tight">
                Movimientos
              </h2>
              <p className="text-xs text-[#5E7165]">
                Mostrando {Math.min(limiteVisible, transaccionesFiltradas.length)} de {transaccionesFiltradas.length} resultados · {transacciones.length} movimientos en el mes
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
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#5E7165]" />
              <input
                type="text"
                aria-label="Buscar movimientos del mes"
                placeholder="Buscar por concepto, categoría o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] pl-10 pr-4 py-2.5 text-xs text-[#1C3028] placeholder:text-[#7A897D] focus:border-emerald-400/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Chips de filtro */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-[#F7F9F5] p-1 border border-[#DCE4DB] text-xs">
                <button
                  type="button"
                  aria-pressed={filtroTipo === "todos"}
                  onClick={() => setFiltroTipo("todos")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "todos"
                      ? "bg-[#E8EEE7] text-[#1C3028] shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  aria-pressed={filtroTipo === "egreso"}
                  onClick={() => setFiltroTipo("egreso")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "egreso"
                      ? "bg-rose-500/20 text-[#AA524A] border border-rose-500/30 shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Egresos
                </button>
                <button
                  type="button"
                  aria-pressed={filtroTipo === "ingreso"}
                  onClick={() => setFiltroTipo("ingreso")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroTipo === "ingreso"
                      ? "bg-emerald-500/20 text-[#286F50] border border-emerald-500/30 shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Ingresos
                </button>
              </div>

              {/* Filtro por Método de Pago */}
              <div className="flex rounded-xl bg-[#F7F9F5] p-1 border border-[#DCE4DB] text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("todos")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "todos"
                      ? "bg-[#E8EEE7] text-[#1C3028] shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Todas las cuentas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("tarjeta")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "tarjeta"
                      ? "bg-cyan-500/20 text-[#317D7D] border border-cyan-500/30 shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  💳 Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("efectivo")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    filtroMetodo === "efectivo"
                      ? "bg-amber-500/20 text-[#A66E31] border border-amber-500/30 shadow-sm"
                      : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  💵 Efectivo
                </button>
              </div>
            </div>
          </div>

          {errorEnvio && (
            <p className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs text-[#AA524A]">
              {errorEnvio}
            </p>
          )}

          {totalTransacciones > transacciones.length && (
            <p className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-xs text-[#A66E31]">
              Mostrando los {transacciones.length} movimientos más recientes de {totalTransacciones} este mes. Usa
              &quot;Exportar Excel&quot; para descargar el mes completo.
            </p>
          )}

          {/* Lista de transacciones */}
          {transaccionesFiltradas.length === 0 ? (
            <div className="py-14 text-center text-xs text-[#7A897D]">
              {transacciones.length === 0
                ? "Todavía no hay movimientos registrados en este mes."
                : "No se encontraron movimientos con los filtros aplicados."}
            </div>
          ) : (
            <div className="space-y-2">
              {transaccionesFiltradas.slice(0, limiteVisible).map((t) => {
                const esIngreso = signoMovimiento(t) > 0;
                const naturaleza = naturalezaDe(t);
                const esEfectivo = t.metodo_pago === "efectivo";

                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.pendiente}
                    onClick={() => {
                      abrirEdicion(t);
                    }}
                    className={`group flex w-full items-center justify-between p-3 sm:p-3.5 gap-3 text-left rounded-xl bg-white border border-[#E6EBE3] hover:border-[#CBD6CA] hover:bg-white transition-all ${
                      t.pendiente ? "opacity-50 cursor-wait" : "cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                          esIngreso
                            ? "bg-emerald-500/10 border-emerald-500/25 text-[#286F50]"
                            : "bg-rose-500/10 border-rose-500/25 text-[#AA524A]"
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
                          <p className="truncate text-sm font-semibold text-[#263D33]">
                            {t.categoria?.nombre ?? "Sin categoría"}
                            {t.cliente?.nombre ? (
                              <span className="ml-1 font-medium text-[#5E7165]">· {t.cliente.nombre}</span>
                            ) : null}
                          </p>
                          <span
                            className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                              esEfectivo
                                ? "bg-amber-500/10 text-[#A66E31] border-amber-500/20"
                                : "bg-cyan-500/10 text-[#317D7D] border-cyan-500/20"
                            }`}
                          >
                            {esEfectivo ? "Efectivo" : "Tarjeta"}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[#5E7165] mt-1">
                          {formatearFechaCorta(t.fecha)}
                          {t.descripcion ? ` · ${t.descripcion}` : ""}
                          {` · ${NOMBRES_NATURALEZA[naturaleza]}`}
                          {!!t.etiquetas?.length && ` · ${t.etiquetas.join(", ")}`}
                          {t.requiere_revision && " · Por revisar"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-sm sm:text-base font-black tabular-nums ${
                          esIngreso ? "text-[#286F50]" : "text-[#1C3028]"
                        }`}
                      >
                        {naturaleza === "traspaso" ? "↔ " : esIngreso ? "+" : "−"}
                        {formatearMonto(t.monto)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {limiteVisible < transaccionesFiltradas.length && <button type="button" className="finance-action w-full mt-4" onClick={() => setLimiteVisible(n => n + 50)}>Ver 50 movimientos más</button>}
        </SpotlightCard>
      </section>

      {/* Modales */}
      <TransactionCaptureModal
        cuentas={cuentas}
        onGuardado={onTransaccionCambiada}
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
