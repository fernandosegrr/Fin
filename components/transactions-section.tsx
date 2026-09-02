"use client";

import { startTransition, useOptimistic, useState, useMemo } from "react";
import { Search, Plus, Layers, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { crearTransaccion, actualizarTransaccion, eliminarTransaccion } from "@/app/dashboard/actions";
import { formatearFechaCorta, hoyISOEnMexico } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import type { Categoria, MetodoPago, TransaccionConCategoria } from "@/lib/types";
import { TransactionCaptureModal, type DatosNuevaTransaccion } from "./transaction-capture-modal";
import { CategoryManagerModal } from "./category-manager-modal";

interface Props {
  initialTransacciones: TransaccionConCategoria[];
  /** Total real de movimientos del mes en la BD (puede ser mayor a `initialTransacciones.length`, que está limitado a 200). */
  totalTransacciones: number;
  categorias: Categoria[];
  onTransaccionCambiada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

type TransaccionOptimista = TransaccionConCategoria & { pendiente?: boolean };

let contadorOptimista = 0;

export function TransactionsSection({
  initialTransacciones,
  totalTransacciones,
  categorias,
  onTransaccionCambiada,
}: Props) {
  const [modalCapturaAbierto, setModalCapturaAbierto] = useState(false);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);
  const [transaccionAEditar, setTransaccionAEditar] = useState<TransaccionConCategoria | null>(null);
  
  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filtroMetodo, setFiltroMetodo] = useState<"todos" | MetodoPago>("todos");

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [transacciones, setTransaccionesOptimista] = useOptimistic<
    TransaccionOptimista[],
    { accion: "crear" | "actualizar" | "eliminar"; item: TransaccionOptimista }
  >(initialTransacciones, (estado, payload) => {
    if (payload.accion === "crear") {
      return [payload.item, ...estado];
    }
    if (payload.accion === "actualizar") {
      return estado.map((t) => (t.id === payload.item.id ? payload.item : t));
    }
    if (payload.accion === "eliminar") {
      return estado.filter((t) => t.id !== payload.item.id);
    }
    return estado;
  });

  // Filtrado de transacciones
  const transaccionesFiltradas = useMemo(() => {
    return transacciones.filter((t) => {
      const cumpleBusqueda =
        !busqueda.trim() ||
        (t.descripcion || "").toLowerCase().includes(busqueda.toLowerCase()) ||
        (t.categoria?.nombre || "").toLowerCase().includes(busqueda.toLowerCase());

      const cumpleTipo = filtroTipo === "todos" || t.categoria?.tipo === filtroTipo;
      const cumpleMetodo = filtroMetodo === "todos" || (t.metodo_pago || "tarjeta") === filtroMetodo;

      return cumpleBusqueda && cumpleTipo && cumpleMetodo;
    });
  }, [transacciones, busqueda, filtroTipo, filtroMetodo]);

  function manejarEnvio(datos: DatosNuevaTransaccion) {
    const categoria = categorias.find((c) => c.id === datos.categoria_id) ?? null;
    contadorOptimista += 1;

    const esIngreso = datos.tipo === "ingreso";

    if (datos.id) {
      // Editar
      const actualizada: TransaccionOptimista = {
        id: datos.id,
        user_id: "",
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        metodo_pago: datos.metodo_pago,
        fecha: datos.fecha || hoyISOEnMexico(),
        descripcion: datos.descripcion,
        creado_en: "",
        categoria: categoria
          ? { id: categoria.id, nombre: categoria.nombre, tipo: categoria.tipo, grupo: categoria.grupo }
          : null,
        pendiente: true,
      };

      setErrorEnvio(null);
      startTransition(async () => {
        setTransaccionesOptimista({ accion: "actualizar", item: actualizada });
        try {
          await actualizarTransaccion(datos.id!, {
            categoria_id: datos.categoria_id,
            monto: datos.monto,
            descripcion: datos.descripcion,
            metodo_pago: datos.metodo_pago,
            fecha: datos.fecha,
          });
          onTransaccionCambiada?.({
            texto: `¡Movimiento de ${formatearMonto(datos.monto)} actualizado con éxito! ✏️`,
            tipo: "success",
          });
        } catch (err) {
          setErrorEnvio(err instanceof Error ? err.message : "Error al actualizar.");
        }
      });
    } else {
      // Crear
      const fecha = datos.fecha || hoyISOEnMexico();
      const nueva: TransaccionOptimista = {
        id: `optimista-${contadorOptimista}`,
        user_id: "",
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        metodo_pago: datos.metodo_pago,
        fecha,
        descripcion: datos.descripcion,
        creado_en: "",
        categoria: categoria
          ? { id: categoria.id, nombre: categoria.nombre, tipo: categoria.tipo, grupo: categoria.grupo }
          : null,
        pendiente: true,
      };

      setErrorEnvio(null);
      startTransition(async () => {
        setTransaccionesOptimista({ accion: "crear", item: nueva });
        try {
          await crearTransaccion({
            categoria_id: datos.categoria_id,
            monto: datos.monto,
            descripcion: datos.descripcion,
            metodo_pago: datos.metodo_pago,
            fecha,
          });
          onTransaccionCambiada?.({
            texto: esIngreso
              ? `¡Ingreso de ${formatearMonto(datos.monto)} registrado! 💰`
              : `¡Egreso de ${formatearMonto(datos.monto)} registrado! 🧾`,
            tipo: "success",
          });
        } catch (err) {
          setErrorEnvio(err instanceof Error ? err.message : "Error al guardar el movimiento.");
        }
      });
    }
  }

  function manejarEliminar(id: string) {
    const itemEliminar = transacciones.find((t) => t.id === id);
    if (!itemEliminar) return;

    setErrorEnvio(null);
    startTransition(async () => {
      setTransaccionesOptimista({ accion: "eliminar", item: itemEliminar });
      try {
        await eliminarTransaccion(id);
        onTransaccionCambiada?.({
          texto: "¡Movimiento eliminado con éxito! 🗑️",
          tipo: "info",
        });
      } catch (err) {
        setErrorEnvio(err instanceof Error ? err.message : "No se pudo eliminar el movimiento.");
      }
    });
  }

  function abrirEdicion(t: TransaccionConCategoria) {
    setTransaccionAEditar(t);
    setModalCapturaAbierto(true);
  }

  function abrirNuevo() {
    setTransaccionAEditar(null);
    setModalCapturaAbierto(true);
  }

  return (
    <>
      <section className="mt-4 px-0 sm:px-4 pb-20">
        <SpotlightCard className="bg-slate-900/60 border-white/10 p-4 sm:p-5 rounded-3xl">
          {/* Controls Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Movimientos del Mes</h2>
              <p className="text-xs text-slate-400">
                Mostrando {transaccionesFiltradas.length} de {transacciones.length} transacciones
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
                className="!py-1.5 !px-3 !text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </GlowButton>
            </div>
          </div>

          {/* Bar de búsqueda y Filtros */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por concepto o categoría..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 pl-10 pr-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {/* Chips de filtro */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroTipo("todos")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroTipo === "todos" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("egreso")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroTipo === "egreso" ? "bg-rose-600 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  Egresos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("ingreso")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroTipo === "ingreso" ? "bg-emerald-600 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  Ingresos
                </button>
              </div>

              {/* Filtro por Método de Pago */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("todos")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroMetodo === "todos" ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  Todas Cuentas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("tarjeta")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroMetodo === "tarjeta" ? "bg-cyan-600 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  💳 Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMetodo("efectivo")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filtroMetodo === "efectivo" ? "bg-amber-600 text-white font-semibold" : "text-slate-400"
                  }`}
                >
                  💵 Efectivo
                </button>
              </div>
            </div>
          </div>

          {errorEnvio && (
            <p className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
              {errorEnvio}
            </p>
          )}

          {totalTransacciones > transacciones.length && (
            <p className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
              Mostrando los {transacciones.length} movimientos más recientes de {totalTransacciones} este mes. Usa
              &quot;Exportar CSV&quot; para ver el mes completo.
            </p>
          )}

          {/* Lista de transacciones */}
          {transaccionesFiltradas.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
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
                  <div
                    key={t.id}
                    onClick={() => abrirEdicion(t)}
                    className={`group flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 hover:border-white/20 hover:bg-slate-800/40 transition-all cursor-pointer ${
                      t.pendiente ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl border ${
                          esIngreso
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {esIngreso ? (
                          <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="truncate text-xs sm:text-sm font-semibold text-slate-200">
                            {t.categoria?.nombre ?? "Sin categoría"}
                          </p>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium border ${
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

                    <div className="flex items-center gap-3 shrink-0 pl-2">
                      <span
                        className={`text-xs sm:text-sm font-bold tabular-nums ${
                          esIngreso ? "text-emerald-400" : "text-slate-100"
                        }`}
                      >
                        {esIngreso ? "+" : "−"}
                        {formatearMonto(t.monto)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SpotlightCard>
      </section>

      {/* Floating Action Button (FAB) con Glow ubicado arriba del Bottom Nav Bar */}
      <button
        type="button"
        onClick={abrirNuevo}
        aria-label="Agregar movimiento"
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-2xl leading-none text-white shadow-xl shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all border border-emerald-300/40"
        style={{
          bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
          right: "max(1.25rem, calc((100vw - 640px) / 2 + 1.25rem))",
        }}
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Modales */}
      <TransactionCaptureModal
        categorias={categorias}
        abierto={modalCapturaAbierto}
        transaccionEditar={transaccionAEditar}
        onCerrar={() => setModalCapturaAbierto(false)}
        onEnviar={manejarEnvio}
        onEliminar={manejarEliminar}
      />

      <CategoryManagerModal
        categorias={categorias}
        abierto={modalCategoriasAbierto}
        onCerrar={() => setModalCategoriasAbierto(false)}
      />
    </>
  );
}
