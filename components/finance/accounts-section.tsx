"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Check, Landmark, Loader2, Plus, TrendingUp, X } from "lucide-react";
import { ajustarSaldoCuenta, actualizarTransferencia, crearTransferencia, eliminarTransferencia, guardarCuenta, registrarRendimiento, restaurarTransferencia } from "@/app/dashboard/actions";
import { formatearMonto, parsearMonto } from "@/lib/format";
import { hoyISOEnMexico } from "@/lib/dates";
import { proyectarRendimientos } from "@/lib/finance/returns";
import type { CuentaConSaldo, ResumenFinanciero } from "@/lib/finance/types";
import type { Transferencia } from "@/lib/types";
import { useEscapeKey } from "@/lib/use-escape-key";
import { ChangeHistory } from "./change-history";

type Modo = "traspaso" | "rendimiento" | "ajuste" | "cuenta";
const campo = "w-full rounded-xl border border-[#DCE4DB] bg-[#F7F9F5] px-3 py-2.5 text-sm focus:border-[#286F50] focus:outline-none";
type Avisar = (mensaje?: { texto: string; tipo?: "success" | "error" | "info" }) => void;

export function AccountsSection({ finanzas: f, transferencias, onCambio }: { finanzas: ResumenFinanciero; transferencias: Transferencia[]; onCambio: Avisar }) {
  const [modo, setModo] = useState<Modo | null>(null);
  const [editando, setEditando] = useState<Transferencia | CuentaConSaldo | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [eliminada, setEliminada] = useState<string | null>(null);
  const cuentas = f.cuentas.filter(c => !c.archivada).sort((a, b) => ({ principal: 0, ahorro: 1, efectivo: 2, reserva: 3 }[a.tipo] - { principal: 0, ahorro: 1, efectivo: 2, reserva: 3 }[b.tipo]));
  const hoy = hoyISOEnMexico();
  const bases = useMemo(() => f.cuentas.map(c => ({ ...c, saldo: f.estimacionRendimientos?.cuentas.find(e => e.cuentaId === c.id)?.saldoProyectado ?? c.saldo })), [f.cuentas, f.estimacionRendimientos]);
  const manana = useMemo(() => proyectarRendimientos(bases, 1, hoy), [bases, hoy]);
  const mes = useMemo(() => proyectarRendimientos(bases, 30, hoy), [bases, hoy]);
  const nombres = new Map(f.cuentas.map(c => [c.id, c.nombre]));
  function abrir(m: Modo, item: typeof editando = null) { setEditando(item); setModo(m); }
  async function borrar(t: Transferencia) {
    if (!confirm("¿Quitar este traspaso del historial? Podrás deshacerlo.")) return;
    setBorrando(true);
    try { await eliminarTransferencia(t.id); setEliminada(t.id); onCambio({ texto: "Traspaso quitado. Puedes deshacerlo aquí." }); }
    catch (e) { onCambio({ texto: e instanceof Error ? e.message : "No se pudo quitar.", tipo: "error" }); }
    finally { setBorrando(false); }
  }
  return <section id="cuentas-rendimientos" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{cuentas.length} cuentas registradas</h2></div><button onClick={() => abrir("cuenta")} className="finance-action"><Plus size={15} /> Nueva cuenta</button></div>
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{cuentas.map(c => {
      const dia = manana.find(p => p.cuentaId === c.id); const treinta = mes.find(p => p.cuentaId === c.id);
      const acumulado = f.estimacionRendimientos?.cuentas.find(p => p.cuentaId === c.id);
      return <article key={c.id} className="finance-card p-5">
        <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-[#5E7165]">{c.banco || (c.tipo === "efectivo" ? "Dinero físico" : "Cuenta propia")}</p><Landmark size={17} className="text-[#286F50]" /></div>
        <h4 className="font-bold mt-2">{c.nombre}</h4><p className="text-3xl font-bold tabular-nums mt-3">{formatearMonto(c.saldo)}</p><p className="text-[10px] text-[#7A897D] mb-3">Saldo registrado</p>
        <p className="text-xs text-[#5E7165]">{c.excluida_disponible ? "Separado del disponible para gastar" : "Incluido en tu disponible"}</p>
        {dia && <div className="account-returns">
          <p><span>Ganado este mes · neto</span><strong>{formatearMonto(c.rendimientosMes)}</strong></p>
          <p><span>Próximo día · estimado</span><strong className="text-[#286F50]">+{formatearMonto(dia.neto)}</strong></p>
          <details><summary>Detalle de rendimientos</summary>
            {acumulado && <><p><span>Saldo con interés estimado</span><strong>{formatearMonto(acumulado.saldoProyectado)}</strong></p><small>Pendiente de confirmar: {formatearMonto(acumulado.neto)} netos al {f.estimacionRendimientos!.hasta}.</small></>}
            <p><span>Tasa anual ponderada</span><strong>{dia.tasaPonderada.toFixed(2)}%</strong></p>
            <p><span>30 días · estimado neto</span><strong>+{formatearMonto(treinta?.neto ?? 0)}</strong></p>
            <small>Estimación con tasas constantes y antes de comisiones del plan. El último abono real o conciliación reinicia el interés pendiente.</small>
          </details>
        </div>}
        <div className="mt-4 flex flex-wrap gap-2"><button className="finance-action !py-1.5" onClick={() => abrir("cuenta", c)}>Editar</button><button className="finance-action !py-1.5" onClick={() => abrir("ajuste", c)}>Conciliar saldo</button>{c.grupo_rendimiento && <button className="finance-action !py-1.5" onClick={() => abrir("rendimiento", c)}>Registrar interés</button>}</div>
      </article>;
    })}</div>
    <div className="finance-card p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-bold flex gap-2 items-center"><ArrowRightLeft size={17} /> Mover dinero entre tus cuentas</h4><p className="text-xs text-[#5E7165] mt-1">Aportar o retirar ahorro no cambia el dinero total que tienes.</p></div><button className="finance-action" onClick={() => abrir("traspaso")}>Registrar traspaso</button></div>
      {eliminada && <div role="status" className="mt-3 text-xs text-[#286F50]">Traspaso quitado. <button className="underline font-semibold" disabled={borrando} onClick={async () => { setBorrando(true); try { await restaurarTransferencia(eliminada); setEliminada(null); onCambio({ texto: "Traspaso restaurado." }); } catch (e) { onCambio({ texto: e instanceof Error ? e.message : "No se pudo restaurar.", tipo: "error" }); } finally { setBorrando(false); } }}>Deshacer</button></div>}
      {!!transferencias.length && <div className="mt-4 divide-y divide-[#DCE4DB]">{transferencias.map(t => <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs" key={t.id}><div><p className="font-semibold">{nombres.get(t.cuenta_origen_id || "") || t.origen} → {nombres.get(t.cuenta_destino_id || "") || t.destino}</p><p className="text-[#5E7165] mt-1">{t.fecha}{t.descripcion ? ` · ${t.descripcion}` : ""}</p></div><div className="flex items-center gap-3"><strong>{formatearMonto(t.monto)}</strong><button className="underline" onClick={() => abrir("traspaso", t)}>Editar</button><button disabled={borrando} className="text-[#AA524A] underline" onClick={() => borrar(t)}>Quitar</button></div></div>)}</div>}
    </div>
    {manana.length > 1 && <p className="rounded-2xl border border-[#DCE4DB] bg-[#F7F9F5] p-4 text-xs leading-relaxed text-[#5E7165]"><TrendingUp size={15} className="inline mr-1.5" />Los apartados del mismo producto comparten los límites de tasa. Sus intereses y retenciones se calculan por separado y las fracciones de centavo se acumulan. El saldo confirmado cambia al registrar el pago real.</p>}
    <ChangeHistory onCambio={onCambio} />
    {modo && <AccountOperation key={`${modo}-${editando?.id || "nuevo"}`} modo={modo} item={editando} cuentas={cuentas} onCerrar={() => setModo(null)} onCambio={onCambio} />}
  </section>;
}

function AccountOperation({ modo, item, cuentas, onCerrar, onCambio }: { modo: Modo; item: Transferencia | CuentaConSaldo | null; cuentas: CuentaConSaldo[]; onCerrar: () => void; onCambio: Avisar }) {
  const cuenta = item && "codigo" in item ? item : null;
  const traspaso = item && "origen" in item ? item : null;
  const [origen, setOrigen] = useState(traspaso?.cuenta_origen_id || cuenta?.id || cuentas.find(c => c.codigo === "principal")?.id || cuentas[0]?.id || "");
  const [destino, setDestino] = useState(traspaso?.cuenta_destino_id || cuentas.find(c => c.tipo === "ahorro")?.id || "");
  const [monto, setMonto] = useState(traspaso ? String(traspaso.monto) : modo === "ajuste" && cuenta ? String(cuenta.saldo) : "");
  const [fecha, setFecha] = useState(traspaso?.fecha || hoyISOEnMexico());
  const [descripcion, setDescripcion] = useState(traspaso?.descripcion || "");
  const [soloNeto, setSoloNeto] = useState(false);
  const [retencion, setRetencion] = useState("");
  const [nombre, setNombre] = useState(cuenta?.nombre || "");
  const [tipo, setTipo] = useState<CuentaConSaldo["tipo"]>(cuenta?.tipo || "ahorro");
  const [banco, setBanco] = useState(cuenta?.banco || "");
  const [remunerada, setRemunerada] = useState(Boolean(cuenta?.grupo_rendimiento));
  const [tasa, setTasa] = useState(String(cuenta?.tasa_anual || 0));
  const [impuesto, setImpuesto] = useState(String(cuenta?.retencion_anual || 0));
  const [desde, setDesde] = useState(cuenta?.rendimiento_desde || hoyISOEnMexico());
  const [guardando, setGuardando] = useState(false); const [error, setError] = useState<string | null>(null);
  const solicitud = useRef(crypto.randomUUID());
  useEscapeKey(!guardando, onCerrar);
  const titulo = modo === "traspaso" ? (traspaso ? "Editar traspaso" : "Registrar traspaso") : modo === "rendimiento" ? "Registrar interés acreditado" : modo === "ajuste" ? "Conciliar saldo real" : cuenta ? "Editar cuenta" : "Nueva cuenta";
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (guardando) return; setGuardando(true); setError(null);
    try {
      if (modo === "traspaso") {
        const a = cuentas.find(c => c.id === origen), b = cuentas.find(c => c.id === destino);
        if (!a || !b || a.id === b.id) throw new Error("Selecciona dos cuentas distintas.");
        const payload = { cuenta_origen_id: a.id, cuenta_destino_id: b.id, origen: a.metodo_pago, destino: b.metodo_pago, monto: parsearMonto(monto), descripcion, fecha, clave_solicitud: solicitud.current };
        if (traspaso) await actualizarTransferencia(traspaso.id, payload); else await crearTransferencia(payload);
      } else if (modo === "rendimiento") {
        await registrarRendimiento({ cuenta_id: origen, fecha, ...(soloNeto ? { neto: parsearMonto(monto) } : { bruto: parsearMonto(monto), retencion: parsearMonto(retencion) }), descripcion, clave_solicitud: solicitud.current });
      } else if (modo === "ajuste") await ajustarSaldoCuenta(origen, parsearMonto(monto), descripcion);
      else await guardarCuenta({ id: cuenta?.id, nombre, tipo, banco, remunerada, rendimiento_desde: desde, tasa_anual: parsearMonto(tasa), retencion_anual: parsearMonto(impuesto), plan: cuenta?.plan });
      onCambio({ texto: "Guardado. Tus saldos ya están actualizados.", tipo: "success" }); onCerrar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }
  const selector = (valor: string, cambiar: (s: string) => void, label: string, lista = cuentas) => <label className="space-y-1 block text-xs font-medium">{label}<select required value={valor} onChange={e => cambiar(e.target.value)} className={campo}>{lista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#14251D]/45 p-0 sm:p-4" onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="operacion-cuenta-titulo" className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 max-h-[90dvh] overflow-y-auto">
      <div className="flex justify-between items-center gap-3"><h3 id="operacion-cuenta-titulo" className="font-bold">{titulo}</h3><button type="button" disabled={guardando} aria-label="Cerrar" onClick={onCerrar}><X size={20} /></button></div>
      <form onSubmit={guardar} className="mt-5 space-y-4">
        {modo === "cuenta" ? <>
          <label className="block text-xs font-medium">Nombre<input required maxLength={80} value={nombre} onChange={e => setNombre(e.target.value)} className={campo} /></label>
          <label className="block text-xs font-medium">Uso<select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)} className={campo}><option value="principal">Disponible para gastar</option><option value="ahorro">Ahorro e inversión</option><option value="efectivo">Efectivo</option></select></label>
          <label className="block text-xs font-medium">Banco o institución<input value={banco} onChange={e => setBanco(e.target.value)} className={campo} /></label>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={remunerada} onChange={e => setRemunerada(e.target.checked)} /> Genera rendimientos</label>
          {remunerada && <><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Tasa anual %<input required inputMode="decimal" value={tasa} onChange={e => setTasa(e.target.value)} className={campo} /></label><label className="text-xs font-medium">Retención anual %<input required inputMode="decimal" value={impuesto} onChange={e => setImpuesto(e.target.value)} className={campo} /></label></div><label className="block text-xs font-medium">Genera rendimientos desde<input required type="date" value={desde} onChange={e => setDesde(e.target.value)} className={campo} /></label><p className="text-xs text-[#5E7165]">Si comparte producto con otros apartados, la tasa se actualiza para todos.</p></>}
        </> : <>
          {selector(origen, setOrigen, modo === "traspaso" ? "Cuenta de origen" : "Cuenta", modo === "rendimiento" ? cuentas.filter(c => c.grupo_rendimiento) : cuentas)}
          {modo === "traspaso" && selector(destino, setDestino, "Cuenta de destino")}
          <label className="block text-xs font-medium">{modo === "rendimiento" ? soloNeto ? "Interés neto recibido" : "Interés bruto" : modo === "ajuste" ? "Saldo que realmente tienes" : "Importe"}<input required inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} className={campo} placeholder="0.00" /></label>
          {modo === "rendimiento" && <><label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={soloNeto} onChange={e => setSoloNeto(e.target.checked)} /> Solo conozco el neto recibido</label>{!soloNeto && <label className="block text-xs font-medium">Impuesto retenido<input required inputMode="decimal" value={retencion} onChange={e => setRetencion(e.target.value)} placeholder="0.00" className={campo} /></label>}<p className="text-xs text-[#5E7165]">Usa los importes acreditados por el banco. Una proyección no acredita dinero.</p></>}
          {modo !== "ajuste" && <label className="block text-xs font-medium">Fecha<input required type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} /></label>}
          <label className="block text-xs font-medium">{modo === "ajuste" ? "Motivo de la diferencia" : "Descripción (opcional)"}<input required={modo === "ajuste"} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={campo} maxLength={500} /></label>
          {modo === "ajuste" && <p className="text-xs text-[#5E7165]">La diferencia se guardará como conciliación de hoy, separada de ingresos y consumo.</p>}
        </>}
        {error && <p role="alert" className="text-sm text-[#AA524A] rounded-xl bg-[#FCF0ED] p-3">{error}</p>}
        <button type="submit" disabled={guardando} className="finance-action-primary w-full">{guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {guardando ? "Guardando…" : "Guardar"}</button>
      </form>
    </div>
  </div>;
}
