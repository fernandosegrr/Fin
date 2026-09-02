"use client";

import { startTransition, useMemo, useOptimistic, useState } from "react";
import { Clock, Plus, CheckCircle2, Zap, Trash2, Calendar, CreditCard, Banknote, X, Loader2 } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { hoyEnMexico } from "@/lib/dates";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { Categoria, GastoRecurrente, MetodoPago, TransaccionConCategoria } from "@/lib/types";
import {
  crearGastoRecurrente,
  eliminarGastoRecurrente,
} from "@/app/dashboard/actions";

interface Props {
  categorias: Categoria[];
  /** Gastos recurrentes iniciales cargados desde Supabase (SSR) */
  initialGastosRecurrentes: GastoRecurrente[];
  /** Transacciones del mes en curso: se usan para saber qué ya se cobró (viene de la BD, no de memoria). */
  transaccionesDelMes: Pick<TransaccionConCategoria, "gasto_recurrente_id">[];
  onRegistrarTransaccion: (datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
    gasto_recurrente_id: string;
    tipo: "egreso";
  }) => Promise<void>;
}

let contadorOptimista = 0;

export function RecurringExpenses({
  categorias,
  initialGastosRecurrentes,
  transaccionesDelMes,
  onRegistrarTransaccion,
}: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [montoTexto, setMontoTexto] = useState("");
  const [diaCobro, setDiaCobro] = useState(5);
  const [categoriaId, setCategoriaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [isSaving, setIsSaving] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  function cerrarModalProgramar() {
    setModalAbierto(false);
    setErrorForm(null);
  }

  useEscapeKey(modalAbierto, cerrarModalProgramar);

  // Derivado de las transacciones reales del mes (no memoria del navegador): sobrevive
  // a cambios de pestaña/refrescos y evita cobrar la misma suscripción dos veces.
  const cobradosEsteMes = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transaccionesDelMes) {
      if (t.gasto_recurrente_id) ids.add(t.gasto_recurrente_id);
    }
    return ids;
  }, [transaccionesDelMes]);

  // Optimistic UI para eliminaciones y creaciones
  const [recurrentes, setRecurrentesOptimista] = useOptimistic<
    GastoRecurrente[],
    { accion: "crear" | "eliminar"; item: GastoRecurrente }
  >(initialGastosRecurrentes, (estado, payload) => {
    if (payload.accion === "crear") return [payload.item, ...estado];
    if (payload.accion === "eliminar") return estado.filter((r) => r.id !== payload.item.id);
    return estado;
  });

  const hoyDia = hoyEnMexico().dia;

  // IDs de gastos recurrentes con un cobro en curso: deshabilita sus botones
  // de "Pagar" mientras se resuelve, para que un doble clic/doble tap (común
  // en móvil con red lenta) no alcance a registrar el mismo cobro dos veces
  // antes de que la UI se entere de que ya se cobró.
  const [procesando, setProcesando] = useState<Set<string>>(new Set());

  async function agregarRecurrente(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number.parseFloat(montoTexto.replace(",", "."));
    if (!nombre.trim() || !Number.isFinite(monto) || monto <= 0) {
      setErrorForm("Ingresa un nombre y un monto válido.");
      return;
    }

    setIsSaving(true);
    setErrorForm(null);

    const catId = categoriaId || (categorias.find((c) => c.tipo === "egreso")?.id ?? "");

    const itemOptimista: GastoRecurrente = {
      id: `opt-${++contadorOptimista}`,
      nombre: nombre.trim(),
      monto,
      dia_cobro: Math.min(31, Math.max(1, Number(diaCobro))),
      categoria_id: catId,
      metodo_pago: metodoPago,
    };

    startTransition(async () => {
      setRecurrentesOptimista({ accion: "crear", item: itemOptimista });
      try {
        await crearGastoRecurrente({
          nombre: itemOptimista.nombre,
          monto: itemOptimista.monto,
          dia_cobro: itemOptimista.dia_cobro,
          categoria_id: catId,
          metodo_pago: metodoPago,
        });
        setNombre("");
        setMontoTexto("");
        setModalAbierto(false);
      } catch (err) {
        setErrorForm(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function eliminarRecurrente(rec: GastoRecurrente) {
    startTransition(async () => {
      setRecurrentesOptimista({ accion: "eliminar", item: rec });
      try {
        await eliminarGastoRecurrente(rec.id);
      } catch (err) {
        console.error("Error al eliminar gasto recurrente:", err);
      }
    });
  }

  async function ejecutarCobro(rec: GastoRecurrente, metodoPagoElegido: MetodoPago) {
    if (procesando.has(rec.id)) return;
    setProcesando((prev) => new Set(prev).add(rec.id));

    const catId = rec.categoria_id || (categorias.find((c) => c.tipo === "egreso")?.id ?? "");
    try {
      await onRegistrarTransaccion({
        categoria_id: catId,
        monto: rec.monto,
        descripcion: `Pago recurrente: ${rec.nombre}`,
        metodo_pago: metodoPagoElegido,
        gasto_recurrente_id: rec.id,
        tipo: "egreso",
      });
    } catch {
      // El toast de error ya lo muestra el padre (onRegistrarTransaccion);
      // aquí solo nos interesa liberar el botón en el `finally`.
    } finally {
      setProcesando((prev) => {
        const siguiente = new Set(prev);
        siguiente.delete(rec.id);
        return siguiente;
      });
    }
  }

  const categoriaEgresoDefault = categorias.find((c) => c.tipo === "egreso");

  return (
    <section className="mt-6">
      <SpotlightCard className="bg-slate-900/60 border-white/10 p-4 sm:p-5 rounded-3xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 leading-none">
                Suscripciones y Gastos Recurrentes
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Sincronizados en la nube · {recurrentes.length} programado
                {recurrentes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <GlowButton
            variant="secondary"
            onClick={() => setModalAbierto(true)}
            className="!py-1.5 !px-2.5 !text-xs"
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
              onClick={() => setModalAbierto(true)}
              className="text-amber-400 hover:underline"
            >
              ¡Agrega tu Gym, Teléfono o Renta!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            {recurrentes.map((rec) => {
              const yaCobrado = cobradosEsteMes.has(rec.id);
              const estaProcesando = procesando.has(rec.id);
              const diasRestantes = rec.dia_cobro - hoyDia;
              const esHoy = rec.dia_cobro === hoyDia;

              return (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/15 transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-slate-200 truncate">{rec.nombre}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium border bg-slate-800 text-slate-300 border-white/10 flex items-center gap-1">
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

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="font-bold text-rose-400 text-xs">
                        {formatearMonto(rec.monto)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" /> Día {rec.dia_cobro} de c/mes
                      </span>
                    </div>

                    <div className="mt-1.5">
                      {yaCobrado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Registrado este mes
                        </span>
                      ) : esHoy ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 animate-pulse">
                          ⚡ Se cobra HOY
                        </span>
                      ) : diasRestantes > 0 ? (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Próximo en {diasRestantes} días
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
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
                    ) : estaProcesando ? (
                      <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 p-1 rounded-xl">
                        <span className="text-[10px] font-bold text-emerald-400 pl-1 pr-0.5 uppercase tracking-wider hidden sm:inline">
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
                Programar Gasto Recurrente
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Concepto / Nombre
                </label>
                <input
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
                <label className="block text-xs font-medium text-slate-400 mb-1">Monto mensual</label>
                <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-amber-400/60">
                  <span className="text-lg font-bold text-slate-400 mr-2">$</span>
                  <input
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
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Día de cobro (del mes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={diaCobro}
                  onChange={(e) => setDiaCobro(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none"
                />
              </div>

              {/* Categoría */}
              {categoriaEgresoDefault && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none appearance-none"
                  >
                    <option value="">Sin categoría</option>
                    {categorias
                      .filter((c) => c.tipo === "egreso")
                      .map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.nombre} {c.grupo ? `(${c.grupo})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Método de pago */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Método de pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
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
                <GlowButton type="submit" variant="primary" disabled={isSaving} className="flex-1">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Guardar
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
