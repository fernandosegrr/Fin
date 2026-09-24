"use client";

import { X, PlusCircle, Pencil, Trash2, Tag, Plus, CreditCard, Banknote, Calendar } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { CategoryManagerModal } from "./category-manager-modal";
import type { Categoria, Cliente, TransaccionConCategoria } from "@/lib/types";
import { useTransactionForm } from "./transactions/use-transaction-form";
import type { DatosNuevaTransaccion } from "./transactions/types";

export type { DatosNuevaTransaccion } from "./transactions/types";

interface Props {
  categorias: Categoria[];
  clientes?: Cliente[];
  abierto: boolean;
  transaccionEditar?: TransaccionConCategoria | null;
  onCerrar: () => void;
  onEnviar: (datos: DatosNuevaTransaccion) => void;
  onEliminar?: (id: string) => void;
  onCategoriasCambiadas?: () => void;
}

export function TransactionCaptureModal(props: Props) {
  const { categorias, clientes = [], abierto, onCerrar, onCategoriasCambiadas } = props;
  const {
    tipo, montoTexto, setMontoTexto, categoriaId, setCategoriaId, descripcion, setDescripcion,
    metodoPago, setMetodoPago, fecha, setFecha, error, modalCategoriasAbierto, setModalCategoriasAbierto,
    clienteId, setClienteId, clienteNuevo, setClienteNuevo, esEdicion, categoriasFiltradas,
    cambiarTipo, manejarEnvio, manejarEliminar,
  } = useTransactionForm(props);

  if (!abierto) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCerrar();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-captura-transaccion"
          className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
            <h2 id="titulo-captura-transaccion" className="text-base font-black text-slate-100 flex items-center gap-2">
              {esEdicion ? (
                <>
                  <Pencil className="h-4 w-4 text-cyan-400" />
                  Editar Movimiento
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 text-emerald-400" />
                  Nuevo Movimiento
                </>
              )}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={manejarEnvio} className="mt-4 space-y-4">
            {/* Toggle Ingreso / Egreso */}
            <div className="flex rounded-2xl bg-slate-950/80 p-1.5 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => cambiarTipo("egreso")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tipo === "egreso"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Egreso (−)
              </button>
              <button
                type="button"
                onClick={() => cambiarTipo("ingreso")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tipo === "ingreso"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Ingreso (+)
              </button>
            </div>

            {/* Selector de Método / Cuenta */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Cuenta / Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMetodoPago("tarjeta")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-bold ${
                    metodoPago === "tarjeta"
                      ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300 shadow-sm"
                      : "bg-slate-950/60 border-white/[0.05] text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="h-4 w-4 text-cyan-400" />
                  Tarjeta / Banco
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoPago("efectivo")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-bold ${
                    metodoPago === "efectivo"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm"
                      : "bg-slate-950/60 border-white/[0.05] text-slate-400 hover:text-white"
                  }`}
                >
                  <Banknote className="h-4 w-4 text-amber-400" />
                  Efectivo
                </button>
              </div>
            </div>

            {/* Input de Monto */}
            <div>
              <label htmlFor="monto" className="block text-xs font-medium text-slate-400 mb-1">
                Monto
              </label>
              <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-3 focus-within:border-emerald-400/60">
                <span className="text-2xl font-bold text-slate-400 mr-2">$</span>
                <input
                  id="monto"
                  name="monto"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  className="w-full bg-transparent text-3xl font-extrabold text-slate-100 placeholder:text-slate-700 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="categoria" className="block text-xs font-medium text-slate-400">
                  Categoría ({tipo})
                </label>
                <button
                  type="button"
                  onClick={() => setModalCategoriasAbierto(true)}
                  className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Crear Categoría
                </button>
              </div>

              <div className="relative">
                {categoriasFiltradas.length === 0 ? (
                  <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-xs text-slate-300 flex items-center justify-between">
                    <span>No tienes categorías de {tipo}</span>
                    <button
                      type="button"
                      onClick={() => setModalCategoriasAbierto(true)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all"
                    >
                      + Crear Ahora
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      id="categoria"
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400/60 focus:outline-none appearance-none"
                    >
                      {categoriasFiltradas.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.nombre} {c.grupo ? `(${c.grupo})` : ""}
                        </option>
                      ))}
                    </select>
                    <Tag className="absolute right-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  </>
                )}
              </div>
            </div>

            {tipo === "ingreso" && (
              <div>
                <label htmlFor="cliente" className="block text-xs font-medium text-slate-400 mb-1">
                  Cliente / proyecto (opcional)
                </label>
                <select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    if (e.target.value) setClienteNuevo("");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none appearance-none"
                >
                  <option value="">Sin cliente / uno nuevo abajo</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {!clienteId && (
                  <input
                    type="text"
                    value={clienteNuevo}
                    onChange={(e) => setClienteNuevo(e.target.value)}
                    placeholder="Nombre nuevo (ej. Chikicut, Intesa...)"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/60 focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* Descripción */}
            <div>
              <label htmlFor="descripcion" className="block text-xs font-medium text-slate-400 mb-1">
                Descripción (opcional)
              </label>
              <input
                id="descripcion"
                type="text"
                placeholder="Ej. Uber, Despensa, Proyecto..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label htmlFor="fecha" className="block text-xs font-medium text-slate-400 mb-1">
                Fecha
              </label>
              <div className="relative flex items-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 focus-within:border-indigo-400/60">
                <Calendar className="h-4 w-4 text-slate-500 mr-2 shrink-0" />
                <input
                  id="fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            )}

            {/* Acciones */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {esEdicion ? (
                <GlowButton type="button" variant="danger" onClick={manejarEliminar}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </GlowButton>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <GlowButton type="button" variant="secondary" onClick={onCerrar}>
                  Cancelar
                </GlowButton>
                <GlowButton type="submit" variant="primary" disabled={!categoriaId}>
                  {esEdicion ? "Guardar" : "Agregar"}
                </GlowButton>
              </div>
            </div>
          </form>
        </div>
      </div>

      <CategoryManagerModal
        onCambio={onCategoriasCambiadas}
        categorias={categorias}
        abierto={modalCategoriasAbierto}
        onCerrar={() => setModalCategoriasAbierto(false)}
        onCategoriaCreada={(creada) => {
          if (creada.tipo === tipo) setCategoriaId(creada.id);
          setModalCategoriasAbierto(false);
        }}
      />
    </>
  );
}
