"use client";

import { Clock, Plus, CheckCircle2, Zap, Trash2, Calendar, CreditCard, Banknote, X, Loader2, Pencil } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { useRecurringExpenses, type RecurringExpensesProps } from "./recurring/use-recurring-expenses";
import { diaCobroEnMes } from "./recurring/dates";

export function RecurringExpenses(props: RecurringExpensesProps) {
  const { categorias, anio, mes } = props;
  const {
    modalAbierto, editando, nombre, setNombre, montoTexto, setMontoTexto, diaCobro, setDiaCobro,
    categoriaId, setCategoriaId, metodoPago, setMetodoPago, isSaving, errorForm, errorLista,
    abrirModalNuevo, abrirModalEditar, cerrarModalProgramar, agregarRecurrente, eliminarRecurrente,
    ejecutarCobro, cobradosEsteMes, recurrentes, procesando, registrados, nombreMesVisto,
    esMesEnCurso, hoyDia, categoriaEgresoDefault, totalProgramado, totalRegistrado,
  } = useRecurringExpenses(props);

  return (
    <section>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Comprometido</p>
            <Clock className="h-4 w-4 text-violet-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 text-slate-100">
            {formatearMonto(totalProgramado)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Suma mensual de suscripciones fijas</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-slate-950/90 p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ya Pagado</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 text-emerald-300">
            {formatearMonto(totalRegistrado)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Cobros marcados en {nombreMesVisto}</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-4 sm:p-5 backdrop-blur-md shadow-lg shadow-black/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Por Cubrir</p>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight mt-2 text-amber-300">
            {formatearMonto(Math.max(0, totalProgramado - totalRegistrado))}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Restante estimado este mes</p>
        </div>
      </div>

      <SpotlightCard
        spotlightColor="rgba(139, 92, 246, 0.12)"
        className="bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950/90 border border-white/[0.08] p-5 sm:p-6 rounded-3xl shadow-xl shadow-black/30"
      >
        {errorLista && <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{errorLista}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 shadow-sm shadow-amber-500/10">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-100 leading-none">
                Tus pagos programados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {recurrentes.length} suscripción{recurrentes.length !== 1 ? "es" : ""} · compromisos de{" "}
                <span className="font-bold text-slate-200">{nombreMesVisto}</span>
              </p>
            </div>
          </div>

          <GlowButton
            variant="primary"
            onClick={abrirModalNuevo}
            className="!py-1.5 !px-3 !text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Programar
          </GlowButton>
        </div>

        {recurrentes.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No tienes pagos recurrentes programados.{" "}
            <button
              type="button"
              onClick={abrirModalNuevo}
              className="text-amber-400 hover:underline"
            >
              ¡Agrega tu Gym, Teléfono o Renta!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-3">
            {recurrentes.map((rec) => {
              const yaCobrado = cobradosEsteMes.has(rec.id) || registrados.has(`${anio}-${mes}-${rec.id}`);
              const estaProcesando = procesando.has(rec.id);
              const diaEfectivo = diaCobroEnMes(anio, mes, rec.dia_cobro);
              const diasRestantes = diaEfectivo - hoyDia;
              const esHoy = diaEfectivo === hoyDia;

              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-white/[0.06] hover:border-white/[0.16] hover:bg-slate-900/60 transition-all shadow-sm"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-base font-semibold text-slate-200 break-words">{rec.nombre}</p>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium border bg-slate-800 text-slate-300 border-white/10 flex items-center gap-1">
                        {rec.metodo_pago === "efectivo" ? (
                          <>
                            <Banknote className="h-2.5 w-2.5 text-amber-400" /> Efectivo
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-2.5 w-2.5 text-cyan-400" /> Tarjeta
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="font-bold text-rose-400 text-xs">
                        {formatearMonto(rec.monto)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" /> Día {diaEfectivo} este mes
                      </span>
                    </div>

                    <div className="mt-1.5">
                      {yaCobrado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Registrado en {nombreMesVisto}
                        </span>
                      ) : !esMesEnCurso ? (
                        // "Se cobra HOY" / "Próximo en N días" solo tienen
                        // sentido en el mes en curso: en cualquier otro mes se
                        // comparaba el día de cobro contra el día de HOY.
                        <span className="text-xs text-slate-400 font-medium">
                          Sin registrar en {nombreMesVisto}
                        </span>
                      ) : esHoy ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 animate-pulse">
                          ⚡ Se cobra HOY
                        </span>
                      ) : diasRestantes > 0 ? (
                        <span className="text-xs text-slate-400 font-medium">
                          Próximo en {diasRestantes} días
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Fecha de cobro cumplida
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {yaCobrado ? (
                      <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 opacity-50 flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> Cobrado
                      </span>
                    ) : !rec.categoria_id ? (
                      <span className="px-2 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        Sin categoría
                      </span>
                    ) : estaProcesando ? (
                      <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 p-1 rounded-xl">
                        <span className="text-xs font-bold text-emerald-400 pl-1 pr-0.5 uppercase tracking-wider hidden sm:inline">
                          Pagar:
                        </span>
                        <button
                          type="button"
                          onClick={() => ejecutarCobro(rec, "tarjeta")}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-cyan-500 hover:text-white transition-all shadow-sm active:scale-95"
                          title="Pagar con Tarjeta"
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => ejecutarCobro(rec, "efectivo")}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm active:scale-95"
                          title="Pagar en Efectivo"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => abrirModalEditar(rec)}
                      className="p-1.5 text-slate-500 hover:text-indigo-300 rounded-lg transition-all"
                      title="Editar suscripción"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarRecurrente(rec)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
                      title="Eliminar pago recurrente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SpotlightCard>

      {/* Modal para agregar Gasto Recurrente */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModalProgramar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-programar-recurrente"
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 id="titulo-programar-recurrente" className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                {editando ? "Editar suscripción" : "Programar Gasto Recurrente"}
              </h3>
              <button
                type="button"
                onClick={cerrarModalProgramar}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={agregarRecurrente} className="mt-4 space-y-3.5">
              {/* Nombre */}
              <div>
                <label htmlFor="recurrente-nombre" className="block text-xs font-medium text-slate-400 mb-1">
                  Concepto / Nombre
                </label>
                <input
                  id="recurrente-nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Netflix, Gym, Renta..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/60 focus:outline-none"
                  required
                />
              </div>

              {/* Monto */}
              <div>
                <label htmlFor="recurrente-monto" className="block text-xs font-medium text-slate-400 mb-1">Monto mensual</label>
                <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-amber-400/60">
                  <span className="text-lg font-bold text-slate-400 mr-2">$</span>
                  <input
                    id="recurrente-monto"
                    type="text"
                    inputMode="decimal"
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-xl font-bold text-slate-100 placeholder:text-slate-700 focus:outline-none tabular-nums"
                    required
                  />
                </div>
              </div>

              {/* Día de cobro */}
              <div>
                <label htmlFor="recurrente-dia" className="block text-xs font-medium text-slate-400 mb-1">
                  Día de cobro (del mes)
                </label>
                <input
                  id="recurrente-dia"
                  type="number"
                  min="1"
                  max="31"
                  value={diaCobro}
                  onChange={(e) => setDiaCobro(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none"
                />
              </div>

              {/* Categoría */}
              <div>
                <label htmlFor="recurrente-categoria" className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                {categoriaEgresoDefault ? (
                  <select
                    id="recurrente-categoria"
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none appearance-none"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categorias
                      .filter((c) => c.tipo === "egreso")
                      .map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.nombre} {c.grupo ? `(${c.grupo})` : ""}
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
                    Primero crea una categoría de egreso para poder programar suscripciones.
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Método de pago
                </label>
                <div role="group" aria-label="Método de pago" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={metodoPago === "tarjeta"}
                    onClick={() => setMetodoPago("tarjeta")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                      metodoPago === "tarjeta"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-cyan-400" />
                    Tarjeta
                  </button>
                  <button
                    type="button"
                    aria-pressed={metodoPago === "efectivo"}
                    onClick={() => setMetodoPago("efectivo")}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                      metodoPago === "efectivo"
                        ? "bg-amber-600/20 border-amber-500 text-amber-300"
                        : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Banknote className="h-4 w-4 text-amber-400" />
                    Efectivo
                  </button>
                </div>
              </div>

              {errorForm && (
                <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                  {errorForm}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <GlowButton type="button" variant="secondary" onClick={cerrarModalProgramar}>
                  Cancelar
                </GlowButton>
                <GlowButton type="submit" variant="primary" disabled={isSaving || !categoriaEgresoDefault} className="flex-1">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {editando ? "Guardar cambios" : "Guardar"}
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
