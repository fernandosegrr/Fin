import { hoyISOEnMexico, rangoDelMes, esMesCalendario } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import { crearTransferencia } from "@/lib/dashboard/transfers";
import { obtenerCuentas, registrarRendimiento } from "@/lib/dashboard/accounts";
import { obtenerInformeFinanciero, buscarHistorialFinanciero, type ItemLibro } from "@/lib/dashboard/ledger";
import { crearCategoria, obtenerCategorias } from "@/lib/dashboard/categories";
import { guardarPresupuesto } from "@/lib/dashboard/budgets";
import { guardarMetaAhorro } from "@/lib/dashboard/goals";
import { normalizarConcepto } from "@/lib/finance/classification";
import { NATURALEZAS, type CuentaFinanciera, type NaturalezaMovimiento } from "@/lib/finance/types";
import type { SupabaseServerClient } from "./types";
import type { TransaccionConCategoria } from "@/lib/types";
import { centavos, naturalezaDe } from "@/lib/finance/ledger";

type Objeto = Record<string, unknown>;
function objeto(s: string): Objeto { const v: unknown = JSON.parse(s || "{}"); if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Argumentos inválidos."); return v as Objeto; }
function texto(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
export function resolverCuenta(cuentas: CuentaFinanciera[], nombre: string) {
  const norm = normalizarConcepto(nombre);
  const exactas = cuentas.filter(c => !c.archivada && (normalizarConcepto(c.nombre) === norm || c.codigo === norm || c.id === nombre));
  const candidatas = exactas.length ? exactas : cuentas.filter(c => !c.archivada && normalizarConcepto(c.nombre).includes(norm));
  if (!norm || candidatas.length !== 1) throw new Error(`Indica una cuenta sin ambigüedad. Disponibles: ${cuentas.filter(c => !c.archivada).map(c => c.nombre).join(", ")}.`);
  return candidatas[0];
}

export const TOOLS_FINANCIERAS_MUTANTES = ["registrar_traspaso", "registrar_rendimiento", "crear_categoria", "guardar_presupuesto", "guardar_meta", "reclasificar_movimientos"];

export async function consultarMovimientosFinancieros(crudo: string): Promise<string> {
  try {
    const a = objeto(crudo);
    const tipo = a.tipo === "ingreso" || a.tipo === "egreso" ? a.tipo : "todos";
    const metodoPago = a.metodo_pago === "tarjeta" || a.metodo_pago === "efectivo" ? a.metodo_pago : "todos";
    const limite = Math.max(1, Math.min(50, Math.trunc(Number(a.limite) || 25)));
    const offset = Math.max(0, Math.trunc(Number(a.offset) || 0));
    let ids: Set<string> | null = null;
    if (texto(a.categoria)) {
      const n = normalizarConcepto(texto(a.categoria));
      const cats = (await obtenerCategorias()).filter(c => normalizarConcepto(c.nombre).includes(n) || normalizarConcepto(c.familia || "") === n);
      if (!cats.length) return "No se encontró esa categoría ni familia.";
      ids = new Set(cats.map(c => c.id));
    }
    const cuenta = texto(a.cuenta) ? resolverCuenta(await obtenerCuentas(), texto(a.cuenta)) : null;
    const naturaleza = texto(a.naturaleza);
    if (naturaleza && !(NATURALEZAS as readonly string[]).includes(naturaleza)) throw new Error("Naturaleza inválida.");
    const filtros = { busqueda: texto(a.busqueda), tipo, metodoPago, cuentaId: cuenta?.id, naturaleza: naturaleza as NaturalezaMovimiento || undefined, desde: texto(a.fecha_inicio), hasta: texto(a.fecha_fin) } as const;
    const todas: ItemLibro[] = [];
    for (let posicion = 0; ; posicion += 1000) {
      const pagina = await buscarHistorialFinanciero({ ...filtros, offset: posicion, limite: 1000 });
      todas.push(...pagina.filas);
      if (todas.length >= pagina.total || !pagina.filas.length) break;
    }
    let filtradas = ids ? todas.filter(i => i.clase === "transaccion" && ids!.has(i.data.categoria_id)) : todas;
    if (a.orden === "mayor_monto") filtradas = [...filtradas].sort((x, y) => centavos(y.data.monto) - centavos(x.data.monto));
    const sumas: Record<string, number> = {};
    for (const f of filtradas) { const n = f.clase === "transferencia" ? "traspaso" : naturalezaDe(f.data); sumas[n] = (sumas[n] || 0) + centavos(f.data.monto); }
    return JSON.stringify({ cobertura: "Totales calculados sobre TODOS los resultados, no solo la página mostrada", total: filtradas.length, offset, mostrados: Math.min(limite, Math.max(0, filtradas.length - offset)), totalesPorNaturaleza: Object.fromEntries(Object.entries(sumas).map(([k, v]) => [k, v / 100])), movimientos: filtradas.slice(offset, offset + limite).map(i => ({ clase: i.clase, id: i.data.id, fecha: i.fecha, monto: i.data.monto, descripcion: i.data.descripcion, ...(i.clase === "transaccion" ? { naturaleza: naturalezaDe(i.data), categoria: i.data.categoria?.nombre, cliente: i.data.cliente?.nombre, cuenta_id: i.data.cuenta_id, cuenta_destino_id: i.data.cuenta_destino_id, etiquetas: i.data.etiquetas, requiere_revision: i.data.requiere_revision, motivo_revision: i.data.motivo_revision } : { origen: i.data.cuenta_origen_id, destino: i.data.cuenta_destino_id }) })) });
  } catch (e) { return `Error al consultar: ${e instanceof Error ? e.message : "No se pudo consultar"}`; }
}

export async function ejecutarHerramientaFinanciera(nombre: string, crudo: string, db: SupabaseServerClient, userId: string, solicitud: string, anio: number, mes: number): Promise<{ texto: string; modificado: boolean }> {
  try {
    const a = objeto(crudo);
    if (nombre === "consultar_resumen_financiero") {
      const rango = rangoDelMes(anio, mes);
      const finMes = new Date(`${rango.finExclusivo}T12:00:00Z`); finMes.setUTCDate(finMes.getUTCDate() - 1);
      const informe = await obtenerInformeFinanciero(texto(a.desde) || rango.inicio, texto(a.hasta) || (finMes.toISOString().slice(0, 10) < hoyISOEnMexico() ? finMes.toISOString().slice(0, 10) : hoyISOEnMexico()));
      return { texto: JSON.stringify(informe), modificado: false };
    }
    if (nombre === "registrar_traspaso") {
      const cuentas = await obtenerCuentas(); const origen = resolverCuenta(cuentas, texto(a.origen)); const destino = resolverCuenta(cuentas, texto(a.destino));
      await crearTransferencia({ monto: Number(a.monto), origen: origen.metodo_pago, destino: destino.metodo_pago, cuenta_origen_id: origen.id, cuenta_destino_id: destino.id, fecha: texto(a.fecha) || undefined, descripcion: texto(a.descripcion) || null, clave_solicitud: solicitud });
      return { texto: `Traspaso registrado: ${formatearMonto(Number(a.monto))} de ${origen.nombre} a ${destino.nombre}. No es consumo ni un nuevo ingreso.`, modificado: true };
    }
    if (nombre === "registrar_rendimiento") {
      const cuenta = resolverCuenta(await obtenerCuentas(), texto(a.cuenta));
      await registrarRendimiento({ cuenta_id: cuenta.id, fecha: texto(a.fecha) || hoyISOEnMexico(), bruto: a.bruto == null ? undefined : Number(a.bruto), retencion: a.retencion == null ? undefined : Number(a.retencion), neto: a.neto == null ? undefined : Number(a.neto), descripcion: texto(a.descripcion), clave_solicitud: solicitud });
      return { texto: `Interés real registrado en ${cuenta.nombre}. Se conservan bruto, retención y neto cuando se proporcionan; no se acreditó una proyección.`, modificado: true };
    }
    if (nombre === "crear_categoria") {
      const tipo = a.tipo === "ingreso" ? "ingreso" : a.tipo === "egreso" ? "egreso" : null;
      if (!tipo) throw new Error("Indica ingreso o egreso.");
      const cat = await crearCategoria({ nombre: texto(a.nombre), tipo, grupo: tipo === "ingreso" ? null : a.grupo === "fijo" ? "fijo" : "variable", familia: texto(a.familia), aliases: Array.isArray(a.aliases) ? a.aliases.filter((x): x is string => typeof x === "string") : [] });
      return { texto: `Categoría creada: ${cat.nombre}, id:${cat.id}.`, modificado: true };
    }
    if (nombre === "guardar_presupuesto") {
      const categorias = await obtenerCategorias(); const cat = categorias.find(c => !c.archivada && normalizarConcepto(c.nombre) === normalizarConcepto(texto(a.categoria)));
      if (!cat || cat.tipo !== "egreso" || (cat.naturaleza && cat.naturaleza !== "egreso")) throw new Error("Elige una categoría de consumo existente.");
      const ay = Number(a.anio ?? anio), mm = Number(a.mes ?? mes); if (!esMesCalendario(ay, mm)) throw new Error("El mes no es válido.");
      await guardarPresupuesto(cat.id, Number(a.limite), rangoDelMes(ay, mm).inicio);
      return { texto: `Presupuesto guardado: ${cat.nombre}, ${formatearMonto(Number(a.limite))}, ${ay}-${String(mm).padStart(2, "0")}.`, modificado: true };
    }
    if (nombre === "guardar_meta") {
      const r = await guardarMetaAhorro({ nombre: texto(a.nombre), monto_objetivo: Number(a.objetivo), fecha_limite: texto(a.fecha_limite) || null });
      if (!r.ok) throw new Error(r.error);
      return { texto: `Meta guardada: ${r.meta.nombre}, objetivo ${formatearMonto(r.meta.monto_objetivo)}. El progreso usa el ahorro separado del disponible.`, modificado: true };
    }
    if (nombre === "reclasificar_movimientos") {
      if (!Array.isArray(a.movimientos) || !a.movimientos.length || a.movimientos.length > 50) throw new Error("Indica entre 1 y 50 movimientos identificados.");
      const cambios = a.movimientos as Objeto[]; const ids = cambios.map(c => texto(c.id));
      if (new Set(ids).size !== ids.length) throw new Error("No repitas el mismo movimiento en el lote.");
      const { data, error } = await db.from("transacciones").select("*").eq("user_id", userId).is("eliminado_en", null).in("id", ids);
      if (error) throw new Error(error.message);
      const actuales = (data ?? []) as TransaccionConCategoria[];
      if (actuales.length !== ids.length) throw new Error("No se encontraron todos los movimientos de tu cuenta; no se modificó ninguno.");
      const categorias = (await obtenerCategorias()).filter(c => !c.archivada);
      const filas = cambios.map(c => {
        const antes = actuales.find(t => t.id === texto(c.id))!;
        const candidatas = categorias.filter(cat => normalizarConcepto(cat.nombre) === normalizarConcepto(texto(c.categoria)));
        if (candidatas.length !== 1) throw new Error(`Categoría ambigua o inexistente: ${texto(c.categoria)}.`);
        const cat = candidatas[0]; const n = texto(c.naturaleza) || cat.naturaleza || antes.naturaleza || cat.tipo;
        if (!(NATURALEZAS as readonly string[]).includes(n) || n === "traspaso") throw new Error("Usa registrar_traspaso para mover ahorro; este lote cambia conceptos y etiquetas.");
        return { antes, despues: { id: antes.id, user_id: userId, categoria_id: cat.id, naturaleza: n as NaturalezaMovimiento, cuenta_destino_id: null, requiere_revision: false, motivo_revision: null, ...(n !== "rendimiento" ? { interes_bruto: null, impuesto_retenido: null } : {}), ...(Array.isArray(c.etiquetas) ? { etiquetas: c.etiquetas.filter((s): s is string => typeof s === "string").slice(0, 12) } : {}) } };
      });
      const r = await db.rpc("aplicar_plan_financiero", { p_plan: { transacciones: filas }, p_lote: solicitud, p_nombre: "Reclasificación del asistente" });
      if (r.error) throw new Error(r.error.message);
      return { texto: `${filas.length} movimientos reclasificados. Se conservaron importes, fechas, cuentas y etiquetas no modificadas. Lote reversible: ${solicitud}.`, modificado: true };
    }
    return { texto: "Herramienta financiera desconocida.", modificado: false };
  } catch (e) { return { texto: `Error: ${e instanceof Error ? e.message : "No se pudo completar la acción"}`, modificado: false }; }
}

function herramienta(name: string, description: string, properties: Objeto, required: string[] = []) { return { type: "function" as const, function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } } }; }
const cadena = { type: "string" }; const numero = { type: "number" }; const fecha = { type: "string", description: "YYYY-MM-DD" };
export const HERRAMIENTAS_FINANCIERAS = [
  herramienta("consultar_resumen_financiero", "Calcula ingresos ganados, apoyos, consumo, reembolsos, deuda, ahorro, saldos por cuenta y proyecciones. Usa todo el historial, sin límite de muestra. Las fechas delimitan el periodo de actividad; los saldos incluyen el arrastre anterior. Para todo el historial usa desde=2000-01-01.", { desde: fecha, hasta: fecha }),
  herramienta("registrar_traspaso", "Registra un movimiento real entre cuentas propias, incluido aportar o retirar ahorro. Usar cuando el usuario pide registrar el traslado; no mueve dinero en el banco.", { origen: cadena, destino: cadena, monto: numero, fecha, descripcion: cadena }, ["origen", "destino", "monto"]),
  herramienta("registrar_rendimiento", "Registra interés realmente acreditado, nunca una estimación. Indica bruto y retención juntos, o solamente neto si no conoce el desglose.", { cuenta: cadena, fecha, bruto: numero, retencion: numero, neto: numero, descripcion: cadena }, ["cuenta"]),
  herramienta("crear_categoria", "Crea una categoría específica cuando lo pide el usuario. Los alias son conceptos que sugerirán esa categoría en capturas futuras.", { nombre: cadena, tipo: { type: "string", enum: ["ingreso", "egreso"] }, familia: cadena, grupo: { type: "string", enum: ["fijo", "variable"] }, aliases: { type: "array", items: cadena } }, ["nombre", "tipo"]),
  herramienta("guardar_presupuesto", "Guarda el límite mensual de una categoría de consumo existente. Un límite de cero quita el presupuesto. No trata ahorro ni capital como gasto.", { categoria: cadena, limite: numero, anio: numero, mes: numero }, ["categoria", "limite"]),
  herramienta("guardar_meta", "Define o actualiza la meta de ahorro del usuario con un objetivo positivo. Su progreso se mide sobre fondos ahorrados.", { nombre: cadena, objetivo: numero, fecha_limite: fecha }, ["nombre", "objetivo"]),
  herramienta("reclasificar_movimientos", "Reclasifica atómicamente hasta 50 movimientos identificados por ID. Conserva montos y fechas, permite corregir naturaleza y etiquetas, y deja un lote reversible. No usar para crear traspasos.", { movimientos: { type: "array", minItems: 1, maxItems: 50, items: { type: "object", properties: { id: cadena, categoria: cadena, naturaleza: { type: "string", enum: [...NATURALEZAS].filter(n => n !== "traspaso") }, etiquetas: { type: "array", items: cadena } }, required: ["id", "categoria"], additionalProperties: false } } }, ["movimientos"]),
];
