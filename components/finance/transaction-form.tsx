"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { actualizarTransaccion, crearCategoria, crearCliente, crearTransaccion, eliminarTransaccion, obtenerDeudasPendientes } from "@/app/dashboard/actions";
import { CategoryManagerModal } from "../category-manager-modal";
import { hoyISOEnMexico } from "@/lib/dates";
import { parsearMonto } from "@/lib/format";
import { naturalezaDe } from "@/lib/finance/ledger";
import { sugerirCategoria } from "@/lib/finance/classification";
import { NATURALEZAS, NOMBRES_NATURALEZA, type CuentaFinanciera, type NaturalezaMovimiento } from "@/lib/finance/types";
import type { Categoria, Cliente, TransaccionConCategoria } from "@/lib/types";
import { useEscapeKey } from "@/lib/use-escape-key";

const campo = "mt-1 w-full rounded-xl border border-[#DCE4DB] bg-[#F7F9F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#286F50]";
interface Props { categorias: Categoria[]; clientes: Cliente[]; cuentas: CuentaFinanciera[]; transaccion?: TransaccionConCategoria | null; onCerrar: () => void; onGuardado?: () => void; }

export function AccountTransactionForm({ categorias, clientes, cuentas, transaccion: t, onCerrar, onGuardado }: Props) {
  const [naturaleza, setNaturaleza] = useState<NaturalezaMovimiento>(t ? naturalezaDe(t) : "egreso");
  const [categoriaId, setCategoriaId] = useState(t?.categoria_id || "");
  const [descripcion, setDescripcion] = useState(t?.descripcion || "");
  const [monto, setMonto] = useState(t ? String(t.monto) : "");
  const [cuentaId, setCuentaId] = useState(t?.cuenta_id || cuentas.find(c => c.codigo === (t?.metodo_pago === "efectivo" ? "efectivo" : "principal"))?.id || "");
  const [destino, setDestino] = useState(t?.cuenta_destino_id || cuentas.find(c => c.tipo === "ahorro")?.id || "");
  const [fecha, setFecha] = useState(t?.fecha || hoyISOEnMexico());
  const [clienteId, setClienteId] = useState(t?.cliente_id || ""); const [clienteNuevo, setClienteNuevo] = useState("");
  const [etiquetas, setEtiquetas] = useState(t?.etiquetas?.join(", ") || "");
  const [revision, setRevision] = useState(Boolean(t?.requiere_revision));
  const [motivo, setMotivo] = useState(t?.motivo_revision || "");
  const [prestamos, setPrestamos] = useState<Awaited<ReturnType<typeof obtenerDeudasPendientes>>>([]);
  const [prestamo, setPrestamo] = useState(t?.movimiento_relacionado_id || "");
  useEffect(() => { if (naturaleza !== "pago_deuda") return; let vigente = true; obtenerDeudasPendientes().then(r => { if (vigente) setPrestamos(r); }).catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudieron cargar los préstamos."); }); return () => { vigente = false; }; }, [naturaleza]);
  const [soloNeto, setSoloNeto] = useState(t?.interes_bruto == null);
  const [bruto, setBruto] = useState(t?.interes_bruto == null ? "" : String(t.interes_bruto));
  const [impuesto, setImpuesto] = useState(t?.impuesto_retenido == null ? "" : String(t.impuesto_retenido));
  const [guardando, setGuardando] = useState(false); const [error, setError] = useState<string | null>(null);
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false); const [extras, setExtras] = useState<Categoria[]>([]);
  const manual = useRef(Boolean(t)); const solicitud = useRef({ payload: "", id: crypto.randomUUID() });
  const todas = useMemo(() => [...categorias, ...extras.filter(c => !categorias.some(x => x.id === c.id))], [categorias, extras]);
  const tipo = ["ingreso", "apoyo", "rendimiento", "reembolso", "financiacion", "ajuste_entrada", "ingreso_pendiente"].includes(naturaleza) ? "ingreso" : "egreso";
  const opciones = todas.filter(c => (!c.archivada || c.id === categoriaId) && (c.tipo === tipo || c.id === categoriaId));
  useEscapeKey(!categoriasAbiertas && !guardando, onCerrar);
  function seleccionarCategoria(id: string) {
    setCategoriaId(id); manual.current = Boolean(id);
    const categoria = todas.find(c => c.id === id);
    if (categoria?.naturaleza) setNaturaleza(categoria.naturaleza);
  }
  function concepto(valor: string) {
    setDescripcion(valor);
    if (!manual.current) {
      const sugerida = sugerirCategoria(valor, todas, tipo);
      setCategoriaId(sugerida?.id || "");
      if (sugerida?.naturaleza) setNaturaleza(sugerida.naturaleza);
    }
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); if (guardando) return; setGuardando(true); setError(null);
    try {
      const cuenta = cuentas.find(c => c.id === cuentaId);
      if (!cuenta) throw new Error("Selecciona una cuenta.");
      let idCategoria = categoriaId;
      if (!idCategoria && !["ingreso", "egreso"].includes(naturaleza)) {
        const existente = todas.find(c => c.naturaleza === naturaleza && !c.archivada);
        idCategoria = existente?.id || (await crearCategoria({ nombre: NOMBRES_NATURALEZA[naturaleza], tipo, grupo: tipo === "egreso" ? "variable" : null, naturaleza, familia: "Movimientos financieros" })).id;
      }
      if (!idCategoria) throw new Error("Selecciona una categoría o escribe un concepto con una regla conocida.");
      let cli = naturaleza === "ingreso" ? clienteId || null : null;
      if (naturaleza === "ingreso" && !cli && clienteNuevo.trim()) cli = (await crearCliente(clienteNuevo.trim())).id;
      const importe = naturaleza === "rendimiento" && !soloNeto ? Math.round((parsearMonto(bruto) - parsearMonto(impuesto)) * 100) / 100 : parsearMonto(monto);
      const payload = { categoria_id: idCategoria, monto: importe, descripcion: descripcion.trim() || null, fecha, naturaleza, cuenta_id: cuentaId, cuenta_destino_id: naturaleza === "traspaso" ? destino : null, metodo_pago: cuenta.metodo_pago, cliente_id: cli, etiquetas: etiquetas.split(",").map(s => s.trim()).filter(Boolean), requiere_revision: revision, motivo_revision: revision ? motivo.trim() : null, interes_bruto: naturaleza === "rendimiento" && !soloNeto ? parsearMonto(bruto) : null, impuesto_retenido: naturaleza === "rendimiento" && !soloNeto ? parsearMonto(impuesto) : null };
      const relacionado = naturaleza === "pago_deuda" ? prestamo || null : t?.movimiento_relacionado_id || null;
      const huella = JSON.stringify({ ...payload, movimiento_relacionado_id: relacionado });
      if (solicitud.current.payload !== huella) solicitud.current = { payload: huella, id: crypto.randomUUID() };
      if (t) await actualizarTransaccion(t.id, { ...payload, movimiento_relacionado_id: relacionado }); else await crearTransaccion({ ...payload, movimiento_relacionado_id: relacionado, clave_solicitud: solicitud.current.id });
      onGuardado?.(); onCerrar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
    finally { setGuardando(false); }
  }
  return <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#14251D]/45 sm:p-4" onClick={e => { if (e.target === e.currentTarget && !guardando) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="nuevo-movimiento-titulo" className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold" id="nuevo-movimiento-titulo">{t ? "Editar movimiento" : "Nuevo movimiento"}</h3><button disabled={guardando} aria-label="Cerrar" onClick={onCerrar}><X size={20} /></button></div>
        <form onSubmit={guardar} className="mt-4 space-y-3.5">
          <label className="block text-xs font-medium">Qué ocurrió<select value={naturaleza} onChange={e => { setNaturaleza(e.target.value as NaturalezaMovimiento); setCategoriaId(""); manual.current = false; }} className={campo}>{NATURALEZAS.map(n => <option value={n} key={n}>{NOMBRES_NATURALEZA[n]}</option>)}</select></label>
          <label className="block text-xs font-medium">Concepto<input value={descripcion} onChange={e => concepto(e.target.value)} maxLength={500} placeholder="Ej. gasolina, café, proyecto…" className={campo} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Cuenta<select required value={cuentaId} onChange={e => setCuentaId(e.target.value)} className={campo}><option value="">Selecciona</option>{cuentas.filter(c => !c.archivada || c.id === cuentaId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label><label className="text-xs font-medium">Fecha<input required type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={campo} /></label></div>
          {naturaleza === "traspaso" && <label className="block text-xs font-medium">Cuenta de destino<select required className={campo} value={destino} onChange={e => setDestino(e.target.value)}>{cuentas.filter(c => !c.archivada && c.id !== cuentaId).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select><span className="text-[#5E7165]">Conserva tu patrimonio y queda separado del consumo.</span></label>}
          {naturaleza === "pago_deuda" && <label className="block text-xs font-medium">Qué deuda estás pagando<select value={prestamo} onChange={e => setPrestamo(e.target.value)} className={campo}><option value="">Deuda anterior sin préstamo registrado</option>{prestamos.map(p => <option key={p.id} value={p.id}>{p.descripcion} · pendiente ${p.pendiente.toFixed(2)}</option>)}{prestamo && !prestamos.some(p => p.id === prestamo) && <option value={prestamo}>Préstamo relacionado ya liquidado</option>}</select></label>}
          {naturaleza === "rendimiento" && <label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={soloNeto} onChange={e => setSoloNeto(e.target.checked)} /> Solo conozco el neto recibido</label>}
          {naturaleza === "rendimiento" && !soloNeto ? <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Interés bruto<input required value={bruto} onChange={e => setBruto(e.target.value)} inputMode="decimal" className={campo} /></label><label className="text-xs font-medium">Retención<input required value={impuesto} onChange={e => setImpuesto(e.target.value)} inputMode="decimal" className={campo} /></label></div> : <label className="block text-xs font-medium">Importe MXN<input required value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" placeholder="0.00" className={campo} /></label>}
          <div><div className="flex justify-between items-center"><label htmlFor="movimiento-categoria-v2" className="text-xs font-medium">Categoría</label><button type="button" onClick={() => setCategoriasAbiertas(true)} className="text-xs font-semibold text-[#286F50] inline-flex gap-1 items-center"><Plus size={12} /> Crear</button></div><select id="movimiento-categoria-v2" value={categoriaId} required={["ingreso", "egreso"].includes(naturaleza)} onChange={e => seleccionarCategoria(e.target.value)} className={campo}><option value="">{["ingreso", "egreso"].includes(naturaleza) ? "Selecciona una categoría" : "Automática según el movimiento"}</option>{opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          {naturaleza === "ingreso" && <><label className="block text-xs font-medium">Cliente / proyecto<select value={clienteId} onChange={e => setClienteId(e.target.value)} className={campo}><option value="">Sin cliente / crear nuevo</option>{clientes.map(c => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select></label>{!clienteId && <input aria-label="Nuevo cliente" placeholder="Nombre de cliente nuevo (opcional)" value={clienteNuevo} onChange={e => setClienteNuevo(e.target.value)} className={campo} />}</>}
          <label className="block text-xs font-medium">Etiquetas (separadas por coma)<input value={etiquetas} onChange={e => setEtiquetas(e.target.value)} placeholder="En pareja, Escuela…" className={campo} /></label>
          <label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={revision} onChange={e => setRevision(e.target.checked)} /> Dejar pendiente de revisión</label>
          {revision && <input aria-label="Qué falta por aclarar" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Qué falta por aclarar" className={campo} />}
          {error && <p role="alert" className="rounded-xl bg-[#FCF0ED] p-3 text-sm text-[#AA524A]">{error}</p>}
          <div className="flex gap-3"><button disabled={guardando} className="finance-action-primary flex-1" type="submit">{guardando ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Guardar</button>{t && <button disabled={guardando} type="button" aria-label="Quitar movimiento" className="finance-action !text-[#AA524A]" onClick={async () => { if (!confirm("¿Quitar este movimiento? Se conserva una copia en el historial de cambios.")) return; setGuardando(true); try { await eliminarTransaccion(t.id); onGuardado?.(); onCerrar(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo quitar."); } finally { setGuardando(false); } }}><Trash2 size={16} /></button>}</div>
        </form>
      </div>
    </div>
    <CategoryManagerModal abierto={categoriasAbiertas} categorias={todas} onCerrar={() => setCategoriasAbiertas(false)} onCategoriaCreada={c => { setExtras(prev => [...prev, c]); setCategoriaId(c.id); manual.current = true; setCategoriasAbiertas(false); }} onCambio={onGuardado} />
  </>;
}
