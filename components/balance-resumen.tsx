"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  History,
  ArrowRightLeft,
  X,
  Loader2,
  Trash2,
  Scale,
} from "lucide-react";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";
import { AnimatedNumber } from "@/components/react-bits/AnimatedNumber";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { formatearMonto, parsearMonto } from "@/lib/format";
import { formatearFechaCorta, hoyEnMexico, hoyISOEnMexico } from "@/lib/dates";
import {
  ajustarSaldo,
  actualizarTransferencia,
  crearTransferencia,
  eliminarTransferencia,
  type BalanceMensual,
} from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { DesgloseMetodoPago, MetodoPago, Transferencia } from "@/lib/types";

interface Props {
  actual: BalanceMensual["actual"];
  onTransferenciaRealizada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

const NOMBRE_METODO: Record<MetodoPago, string> = {
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

function DesgloseMetodo({
  icono,
  etiqueta,
  desglose,
}: {
  icono: ReactNode;
  etiqueta: string;
  desglose: DesgloseMetodoPago;
}) {
  const arrastre = desglose.saldo - desglose.neto;
  const netoMes = desglose.neto;
  return (
    <div className="p-2 rounded-xl bg-slate-950/50 border border-white/5 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="flex items-center gap-1.5 text-slate-400 font-medium truncate">
          {icono} {etiqueta}:
        </span>
        <span className="font-bold tabular-nums text-slate-200">{formatearMonto(desglose.saldo)}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-tight">
        Arrastre {formatearMonto(arrastre)}
        {" · "}
        <span className={desglose.saldo < 0 ? "text-rose-400/80" : "text-slate-400"}>
          {netoMes > 0 ? `Subió ${formatearMonto(netoMes)} este mes` :
            netoMes < 0 ? `Bajó ${formatearMonto(Math.abs(netoMes))} este mes` : "Sin cambio este mes"}
        </span>
      </p>
    </div>
  );
}

export function BalanceResumen({ actual, onTransferenciaRealizada }: Props) {
  const saldoPositivo = actual.saldoTotalDisponible >= 0;

  // Fondos disponibles del mes: incluye el saldo que llegó de meses anteriores.
  const fondosDelMes = Math.max(0, actual.saldoInicial + actual.ingresos);
  const porcentajeDisponible = fondosDelMes > 0
    ? Math.max(0, Math.round((actual.saldoTotalDisponible / fondosDelMes) * 100))
    : 0;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");
  const [origen, setOrigen] = useState<MetodoPago>("tarjeta");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [transferenciaEditandoId, setTransferenciaEditandoId] = useState<string | null>(null);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [ajusteMetodo, setAjusteMetodo] = useState<MetodoPago>("efectivo");
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteError, setAjusteError] = useState<string | null>(null);
  const [ajusteSaving, setAjusteSaving] = useState(false);

  const destino: MetodoPago = origen === "tarjeta" ? "efectivo" : "tarjeta";
  const hoy = hoyEnMexico();
  const esMesEnCurso = actual.anio === hoy.anio && actual.mes === hoy.mes;

  useEscapeKey(modalAbierto, () => setModalAbierto(false));
  useEscapeKey(modalAjuste, () => setModalAjuste(false));

  function abrirModalAjuste() {
    const metodoInicial: MetodoPago = "efectivo";
    setAjusteMetodo(metodoInicial);
    setAjusteMonto(esMesEnCurso ? String(actual.totalesEfectivo.saldo) : "");
    setAjusteError(null);
    setModalAjuste(true);
  }

  async function manejarAjuste(e: React.FormEvent) {
    e.preventDefault();
    const objetivo = parsearMonto(ajusteMonto);
    if (!Number.isFinite(objetivo)) {
      setAjusteError("Ingresa el saldo real que tienes.");
      return;
    }
    setAjusteSaving(true);
    setAjusteError(null);
    const resultado = await ajustarSaldo(ajusteMetodo, objetivo);
    setAjusteSaving(false);
    if (!resultado.ok) {
      setAjusteError(resultado.error);
      return;
    }
    setModalAjuste(false);
    const signo = resultado.diferencia >= 0 ? "+" : "−";
    onTransferenciaRealizada?.({
      texto: `Saldo de ${NOMBRE_METODO[ajusteMetodo]} ajustado (${signo}${formatearMonto(Math.abs(resultado.diferencia))}).`,
      tipo: "success",
    });
  }

  function abrirModalTransferencia() {
    setMontoTexto("");
    setDescripcion("");
    setOrigen("tarjeta");
    setFecha(hoyISOEnMexico());
    setErrorForm(null);
    setTransferenciaEditandoId(null);
    setModalAbierto(true);
  }

  function abrirEdicionTransferencia(t: Transferencia) {
    setMontoTexto(String(t.monto));
    setDescripcion(t.descripcion ?? "");
    setOrigen(t.origen);
    setFecha(t.fecha);
    setErrorForm(null);
    setTransferenciaEditandoId(t.id);
    setModalAbierto(true);
  }

  function cancelarEdicionTransferencia() {
    setTransferenciaEditandoId(null);
    setMontoTexto("");
    setDescripcion("");
    setOrigen("tarjeta");
    setFecha(hoyISOEnMexico());
    setErrorForm(null);
  }

  async function manejarEnvioTransferencia(e: React.FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(montoTexto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorForm("Ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSaving(true);
    setErrorForm(null);
    try {
      if (transferenciaEditandoId) {
        await actualizarTransferencia(transferenciaEditandoId, {
          monto,
          origen,
          destino,
          descripcion: descripcion.trim() || null,
          fecha,
        });
        setModalAbierto(false);
        onTransferenciaRealizada?.({
          texto: `Traspaso corregido: ${formatearMonto(monto)} de ${NOMBRE_METODO[origen]} a ${NOMBRE_METODO[destino]}. ✏️`,
          tipo: "success",
        });
      } else {
        await crearTransferencia({ monto, origen, destino, descripcion: descripcion.trim() || null, fecha });
        setModalAbierto(false);
        onTransferenciaRealizada?.({
          texto: `¡Traspaso de ${formatearMonto(monto)} de ${NOMBRE_METODO[origen]} a ${NOMBRE_METODO[destino]} registrado! ⇄`,
          tipo: "success",
        });
      }
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "Error al registrar el traspaso.");
    } finally {
      setIsSaving(false);
    }
  }

  async function manejarEliminarTransferencia(id: string) {
    if (eliminandoId) return;
    if (!confirm("¿Eliminar este traspaso? El saldo de cada método se revertirá.")) return;
    setEliminandoId(id);
    setErrorForm(null);
    try {
      await eliminarTransferencia(id);
      if (transferenciaEditandoId === id) cancelarEdicionTransferencia();
      onTransferenciaRealizada?.({
        texto: "Traspaso eliminado.",
        tipo: "info",
      });
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo eliminar el traspaso.");
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <>
    <section className="pt-2">
      <SpotlightCard
        spotlightColor={saldoPositivo ? "rgba(16, 244, 177, 0.15)" : "rgba(244, 63, 94, 0.15)"}
        className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-900/75 to-slate-950/95 border border-white/[0.08] p-5 sm:p-7 rounded-3xl shadow-xl shadow-black/40"
      >
        {/* Glow sutil de fondo */}
        <div
          className={`absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700 ${
            saldoPositivo ? "bg-emerald-500" : "bg-rose-500"
          }`}
        />

        {/* Encabezado del Balance */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 shadow-sm shadow-emerald-500/10">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400 block leading-tight">
                Saldo Total Disponible
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Patrimonio líquido acumulado
              </span>
            </div>
          </div>

          {/* Porcentaje de fondos que permanece disponible */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300 backdrop-blur-md shrink-0 shadow-sm shadow-emerald-500/10">
            <PiggyBank className="h-3.5 w-3.5" />
            <span>{porcentajeDisponible}% disponible</span>
          </div>
        </div>

        {/* Monto principal: Saldo Total Disponible Acumulado */}
        <div className="mt-4 flex items-baseline gap-2">
          <div
            className={`text-3xl sm:text-5xl font-black tracking-tight tabular-nums ${
              saldoPositivo ? "text-slate-100" : "text-rose-400"
            }`}
          >
            <AnimatedNumber value={actual.saldoTotalDisponible} />
          </div>
        </div>

        {/* Linea de Arrastre de Meses Anteriores */}
        {actual.saldoInicial !== 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-300">
            <History className="h-3.5 w-3.5 text-indigo-400" />
            <span>Arrastre meses anteriores: <strong>{formatearMonto(actual.saldoInicial)}</strong></span>
          </div>
        )}

        {/* Grid de Egresos e Ingresos del Mes */}
        <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.07]">
          {/* Egresos */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-3 sm:p-4 backdrop-blur-sm transition-all hover:border-rose-500/35">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
              <ArrowDownRight className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="truncate">Egresos del Mes</span>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-black tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.egresos} />
            </p>
          </div>

          {/* Ingresos */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3 sm:p-4 backdrop-blur-sm transition-all hover:border-emerald-500/35">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <ArrowUpRight className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="truncate">Ingresos del Mes</span>
            </div>
            <p className="mt-1.5 text-lg sm:text-2xl font-black tabular-nums text-slate-100 truncate">
              <AnimatedNumber value={actual.ingresos} />
            </p>
          </div>
        </div>

        {/* Desglose por Método de Pago: Efectivo vs Tarjeta / Banco */}
        <div className="mt-4 pt-4 border-t border-white/[0.07]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Saldo por método de pago
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={abrirModalAjuste}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 hover:text-white transition-all shadow-sm"
              >
                <Scale className="h-3 w-3" /> Ajustar
              </button>
              <button
                type="button"
                onClick={abrirModalTransferencia}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/20 hover:text-white transition-all shadow-sm"
              >
                <ArrowRightLeft className="h-3 w-3" /> Transferir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-[11px]">
            <DesgloseMetodo
              icono={<Banknote className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
              etiqueta="Efectivo"
              desglose={actual.totalesEfectivo}
            />
            <DesgloseMetodo
              icono={<CreditCard className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
              etiqueta="Tarjeta/Banco"
              desglose={actual.totalesTarjeta}
            />
          </div>
        </div>

      </SpotlightCard>
    </section>

    {/* Modal de Traspaso entre métodos de pago */}
    {modalAbierto && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalAbierto(false);
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-traspaso"
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 id="titulo-traspaso" className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
              {transferenciaEditandoId ? "Editar traspaso" : "Traspasar entre cuentas"}
            </h3>
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={manejarEnvioTransferencia} className="mt-4 space-y-3.5">
            {transferenciaEditandoId && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-[11px] text-indigo-300">
                <span>Corrigiendo un traspaso existente.</span>
                <button
                  type="button"
                  onClick={cancelarEdicionTransferencia}
                  className="font-semibold underline underline-offset-2 hover:text-indigo-200 shrink-0"
                >
                  Cancelar edición
                </button>
              </div>
            )}

            {/* Origen -> Destino */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Desde</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrigen("tarjeta")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "tarjeta"
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                      : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <CreditCard className="h-4 w-4 text-cyan-400" />
                  Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setOrigen("efectivo")}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all text-xs font-semibold ${
                    origen === "efectivo"
                      ? "bg-amber-600/20 border-amber-500 text-amber-300"
                      : "bg-slate-950/60 border-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Banknote className="h-4 w-4 text-amber-400" />
                  Efectivo
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Disponible en {NOMBRE_METODO[origen]}:{" "}
                <span className="font-semibold text-slate-300">
                  {formatearMonto(origen === "efectivo" ? actual.totalesEfectivo.saldo : actual.totalesTarjeta.saldo)}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>{NOMBRE_METODO[origen]}</span>
              <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400" />
              <span>{NOMBRE_METODO[destino]}</span>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Monto a traspasar</label>
              <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-indigo-400/60">
                <span className="text-lg font-bold text-slate-400 mr-2">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent text-xl font-bold text-slate-100 placeholder:text-slate-700 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                placeholder="Ej. Retiro de cajero, Depósito..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {errorForm && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                {errorForm}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <GlowButton type="button" variant="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </GlowButton>
              <GlowButton type="submit" variant="primary" disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {transferenciaEditandoId ? "Guardar cambios" : "Traspasar"}
              </GlowButton>
            </div>

            {actual.transferencias.length > 0 && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Traspasos este mes · toca uno para corregirlo
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {actual.transferencias.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => abrirEdicionTransferencia(t)}
                      title="Editar traspaso"
                      className={`flex w-full items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors text-left ${
                        transferenciaEditandoId === t.id
                          ? "bg-indigo-600/10 border-indigo-500/50"
                          : "bg-slate-950/50 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span className="text-slate-400 min-w-0 truncate">
                        {formatearFechaCorta(t.fecha)} · {NOMBRE_METODO[t.origen]} → {NOMBRE_METODO[t.destino]}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="font-semibold tabular-nums text-slate-200">
                          {formatearMonto(t.monto)}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            manejarEliminarTransferencia(t.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.stopPropagation();
                            e.preventDefault();
                            manejarEliminarTransferencia(t.id);
                          }}
                          aria-label="Eliminar traspaso"
                          aria-disabled={eliminandoId === t.id}
                          className="p-0.5 text-slate-500 hover:text-rose-400 aria-disabled:opacity-50"
                        >
                          {eliminandoId === t.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    )}

    {modalAjuste && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalAjuste(false);
        }}
      >
        <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Scale className="h-4 w-4 text-amber-400" /> Ajustar saldo
            </h3>
            <button type="button" onClick={() => setModalAjuste(false)} aria-label="Cerrar" className="p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={manejarAjuste} className="mt-4 space-y-3.5">
            <p className="text-[11px] text-slate-400">
              Pon lo que tienes de verdad hoy. Se crea un ajuste (ingreso o egreso) para cuadrar, sin borrar el historial.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAjusteMetodo("efectivo");
                  if (esMesEnCurso) setAjusteMonto(String(actual.totalesEfectivo.saldo));
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold ${
                  ajusteMetodo === "efectivo"
                    ? "bg-amber-600/20 border-amber-500 text-amber-300"
                    : "bg-slate-950/60 border-white/5 text-slate-400"
                }`}
              >
                <Banknote className="h-4 w-4" /> Efectivo
              </button>
              <button
                type="button"
                onClick={() => {
                  setAjusteMetodo("tarjeta");
                  if (esMesEnCurso) setAjusteMonto(String(actual.totalesTarjeta.saldo));
                }}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold ${
                  ajusteMetodo === "tarjeta"
                    ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                    : "bg-slate-950/60 border-white/5 text-slate-400"
                }`}
              >
                <CreditCard className="h-4 w-4" /> Tarjeta
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Saldo real</label>
              <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-amber-400/60">
                <span className="text-lg font-bold text-slate-400 mr-2">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ajusteMonto}
                  onChange={(e) => setAjusteMonto(e.target.value)}
                  placeholder="3000"
                  className="w-full bg-transparent text-xl font-bold text-slate-100 focus:outline-none tabular-nums"
                />
              </div>
            </div>
            {ajusteError && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">{ajusteError}</p>
            )}
            <GlowButton type="submit" variant="primary" disabled={ajusteSaving} className="w-full">
              {ajusteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              Cuadrar saldo
            </GlowButton>
          </form>
        </div>
      </div>
    )}
    </>
  );
}
