"use client";

import { useState } from "react";
import { Clock, Plus, CheckCircle2, Zap, Trash2, Calendar, CreditCard, Banknote, X } from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto } from "@/lib/format";
import { hoyISOEnMexico } from "@/lib/dates";
import type { Categoria, GastoRecurrente, MetodoPago } from "@/lib/types";

interface Props {
  categorias: Categoria[];
  onRegistrarTransaccion: (datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
    tipo: "egreso";
  }) => void;
}

const GASTOS_EJEMPLO_INICIALES: GastoRecurrente[] = [
  {
    id: "rec-1",
    nombre: "Gimnasio",
    monto: 650,
    dia_cobro: 5,
    categoria_id: "",
    metodo_pago: "tarjeta",
  },
  {
    id: "rec-2",
    nombre: "Plan Celular / Teléfono",
    monto: 450,
    dia_cobro: 15,
    categoria_id: "",
    metodo_pago: "tarjeta",
  },
];

export function RecurringExpenses({ categorias, onRegistrarTransaccion }: Props) {
  const [recurrentes, setRecurrentes] = useState<GastoRecurrente[]>(() => {
    if (typeof window !== "undefined") {
      const guardados = localStorage.getItem("nexfin_recurrentes");
      if (guardados) {
        try {
          return JSON.parse(guardados);
        } catch {
          // fallback
        }
      }
    }
    return GASTOS_EJEMPLO_INICIALES;
  });

  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [montoTexto, setMontoTexto] = useState("");
  const [diaCobro, setDiaCobro] = useState(5);
  const [categoriaId, setCategoriaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");

  const [cobradosEsteMes, setCobradosEsteMes] = useState<Record<string, boolean>>({});

  function guardarRecurrentes(nuevos: GastoRecurrente[]) {
    setRecurrentes(nuevos);
    if (typeof window !== "undefined") {
      localStorage.setItem("nexfin_recurrentes", JSON.stringify(nuevos));
    }
  }

  const hoyDia = new Date().getDate();

  function agregarRecurrente(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number.parseFloat(montoTexto.replace(",", "."));
    if (!nombre.trim() || !Number.isFinite(monto) || monto <= 0) return;

    const catId = categoriaId || (categorias.find((c) => c.tipo === "egreso")?.id ?? "");

    const nuevo: GastoRecurrente = {
      id: `rec-${Date.now()}`,
      nombre: nombre.trim(),
      monto,
      dia_cobro: Math.min(31, Math.max(1, Number(diaCobro))),
      categoria_id: catId,
      metodo_pago: metodoPago,
    };

    guardarRecurrentes([...recurrentes, nuevo]);
    setNombre("");
    setMontoTexto("");
    setModalAbierto(false);
  }

  function eliminarRecurrente(id: string) {
    guardarRecurrentes(recurrentes.filter((r) => r.id !== id));
  }

  function ejecutarCobro(rec: GastoRecurrente) {
    const catId = rec.categoria_id || (categorias.find((c) => c.tipo === "egreso")?.id ?? "");
    onRegistrarTransaccion({
      categoria_id: catId,
      monto: rec.monto,
      descripcion: `Pago recurrente: ${rec.nombre}`,
      metodo_pago: rec.metodo_pago,
      tipo: "egreso",
    });

    setCobradosEsteMes((prev) => ({ ...prev, [rec.id]: true }));
  }

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
                Cobros automáticos y pagos fijos del mes
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
            No tienes pagos recurrentes programados. ¡Agrega tu Gym, Teléfono o Renta!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
            {recurrentes.map((rec) => {
              const yaCobrado = cobradosEsteMes[rec.id];
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

                    {/* Status badge */}
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
                    <button
                      type="button"
                      onClick={() => ejecutarCobro(rec)}
                      disabled={yaCobrado}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        yaCobrado
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-95"
                      }`}
                      title="Registrar cobro en las transacciones del mes"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {yaCobrado ? "Cobrado" : "Cobrar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarRecurrente(rec.id)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                Programar Gasto Recurrente
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={agregarRecurrente} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Concepto / Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Gimnasio, Teléfono, Netflix, Renta..."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Monto Mensual</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={montoTexto}
                    onChange={(e) => setMontoTexto(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Día de Cobro (1-31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaCobro}
                    onChange={(e) => setDiaCobro(Number(e.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:outline-none appearance-none"
                >
                  {categorias
                    .filter((c) => c.tipo === "egreso")
                    .map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.nombre} ({c.grupo})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago("tarjeta")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      metodoPago === "tarjeta"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-white/5 text-slate-400"
                    }`}
                  >
                    💳 Tarjeta
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodoPago("efectivo")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                      metodoPago === "efectivo"
                        ? "bg-amber-600/20 border-amber-500 text-amber-300"
                        : "bg-slate-950 border-white/5 text-slate-400"
                    }`}
                  >
                    💵 Efectivo
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <GlowButton type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </GlowButton>
                <GlowButton type="submit" variant="primary">
                  Guardar Programación
                </GlowButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
