import { centavos, resumirLibro } from "./ledger";
import type { CuentaFinanciera, FilaFinanciera, NaturalezaMovimiento } from "./types";
import type { Categoria, Cliente, GastoRecurrente, MetaAhorro, Presupuesto, Transaccion, Transferencia } from "@/lib/types";

export interface InstantaneaFinanciera {
  categorias: Categoria[]; transacciones: Transaccion[]; transferencias: Transferencia[];
  gastos_recurrentes: GastoRecurrente[]; presupuestos: Presupuesto[]; metas_ahorro: MetaAhorro[]; clientes: Cliente[];
  cuentas_financieras?: CuentaFinanciera[];
}
export interface CategoriaPropuesta { clave: string; nombre: string; familia: string; tipo: "ingreso" | "egreso"; grupo: "fijo" | "variable" | null; naturaleza: NaturalezaMovimiento; aliases?: string[] }
export interface DecisionReclasificacion {
  id: string; categoria: string; naturaleza: NaturalezaMovimiento;
  cuenta?: string; destino?: string; etiquetas?: string[]; requiere_revision?: boolean; motivo_revision?: string | null;
  deuda_liquidada_en?: string | null;
  partes?: { monto: number; categoria: string; naturaleza: NaturalezaMovimiento; descripcion: string; requiere_revision?: boolean; motivo_revision?: string }[];
}
export interface ConfiguracionReclasificacion {
  email: string; fecha: string; loteId: string;
  categorias: CategoriaPropuesta[]; decisiones: DecisionReclasificacion[];
  cuentas: (Partial<CuentaFinanciera> & { codigo: string; nombre: string; tipo: CuentaFinanciera["tipo"]; metodo_pago: CuentaFinanciera["metodo_pago"] })[];
  transferenciasNuevas: { origen: string; destino: string; monto: number; fecha: string; descripcion: string }[];
  recurrentes: { id: string; categoria: string }[];
  meta?: { nombre: string; objetivo: number; cuenta: string };
  presupuestoInicial?: boolean;
}
type Fila = Record<string, unknown>;
export type CambioFinanciero = { antes: Fila | null; despues: Fila };
export type PlanFinanciero = Record<string, CambioFinanciero[]>;
function fila(valor: object): Fila { return valor as unknown as Fila; }
function mismoValor(clave: string, a: unknown, b: unknown) { return clave === "creado_en" ? Date.parse(String(a)) === Date.parse(String(b)) : JSON.stringify(a) === JSON.stringify(b); }

/** Constructor puro: no escribe. La única escritura posterior es el RPC transaccional. */
export function prepararReclasificacion(original: InstantaneaFinanciera, actual: InstantaneaFinanciera, config: ConfiguracionReclasificacion, nuevoId = () => crypto.randomUUID()) {
  const userId = original.transacciones[0]?.user_id || original.categorias[0]?.user_id;
  if (!userId || original.transacciones.some(t => t.user_id !== userId) || actual.transacciones.some(t => t.user_id !== userId)) throw new Error("La instantánea debe pertenecer a una única cuenta.");
  if (!actual.cuentas_financieras?.length) throw new Error("La estructura de cuentas todavía no está disponible.");
  for (const tabla of ["categorias", "transferencias", "gastos_recurrentes", "presupuestos", "metas_ahorro", "clientes"] as const) {
    if (original[tabla].length !== actual[tabla].length) throw new Error(`Cambió ${tabla} desde la auditoría; actualiza la propuesta.`);
    for (const registro of original[tabla]) {
      const presente = actual[tabla].find(r => r.id === registro.id);
      if (!presente || Object.entries(registro).some(([k, v]) => !mismoValor(k, fila(presente)[k], v))) throw new Error(`Cambió ${tabla} desde la auditoría; no se sobrescribió.`);
    }
  }
  const decisiones = new Map(config.decisiones.map(d => [d.id, d]));
  if (decisiones.size !== original.transacciones.length || config.decisiones.length !== decisiones.size) throw new Error("La propuesta no cubre exactamente todos los movimientos originales.");
  if (actual.transacciones.length !== original.transacciones.length || actual.transacciones.some(t => !decisiones.has(t.id))) throw new Error("Hay movimientos nuevos o eliminados desde la auditoría; actualiza la propuesta antes de aplicar.");
  const plan: PlanFinanciero = { cuentas_financieras: [], categorias: [], transacciones: [], transferencias: [], gastos_recurrentes: [], presupuestos: [], metas_ahorro: [] };
  const cuentas = actual.cuentas_financieras.map(c => ({ ...c }));
  for (const def of config.cuentas) {
    const antes = cuentas.find(c => c.codigo === def.codigo) || null;
    const despues = { tasa_anual: 0, tasa_excedente: 0, tasa_superior: 0, retencion_anual: 0, limite_preferente: 25000, limite_segundo_tramo: 1000000, archivada: false, excluida_disponible: def.tipo === "ahorro" || def.tipo === "reserva", banco: null, grupo_rendimiento: null, rendimiento_desde: null, plan: null, ...antes, ...def, id: antes?.id || nuevoId(), user_id: userId } as CuentaFinanciera;
    plan.cuentas_financieras.push({ antes: antes ? fila(antes) : null, despues: fila(despues) });
    if (antes) cuentas.splice(cuentas.findIndex(c => c.id === antes.id), 1, despues); else cuentas.push(despues);
  }
  const cuenta = (codigo: string) => { const c = cuentas.find(x => x.codigo === codigo); if (!c) throw new Error(`Cuenta no encontrada: ${codigo}`); return c; };
  const categorias = actual.categorias.map(c => ({ ...c }));
  const destinoCategoria = new Map<string, Categoria>();
  for (const def of config.categorias) {
    const antes = categorias.find(c => c.nombre.trim().toLocaleLowerCase("es-MX") === def.nombre.trim().toLocaleLowerCase("es-MX") && c.tipo === def.tipo) || null;
    const despues: Categoria = { ...antes, id: antes?.id || nuevoId(), user_id: userId, nombre: def.nombre, tipo: def.tipo, grupo: def.tipo === "ingreso" ? null : def.grupo || "variable", familia: def.familia, naturaleza: def.naturaleza, archivada: false, aliases: [...new Set([...(antes?.aliases || []), ...(def.aliases || [])])] };
    if (destinoCategoria.has(def.clave)) throw new Error("Hay una categoría repetida en la propuesta.");
    destinoCategoria.set(def.clave, despues); plan.categorias.push({ antes: antes ? fila(antes) : null, despues: fila(despues) });
    if (antes) categorias.splice(categorias.findIndex(c => c.id === antes.id), 1, despues); else categorias.push(despues);
  }
  const categoria = (clave: string) => { const c = destinoCategoria.get(clave); if (!c) throw new Error(`Categoría no encontrada: ${clave}`); return c; };
  const originales = new Map(original.transacciones.map(t => [t.id, t]));
  const nuevas: Transaccion[] = [];
  for (const antes of actual.transacciones) {
    const base = originales.get(antes.id); const d = decisiones.get(antes.id);
    if (!base || !d || antes.eliminado_en) throw new Error("Hay un movimiento que requiere una nueva auditoría.");
    for (const [key, value] of Object.entries(base)) {
      // REST y to_jsonb usan representaciones equivalentes de zona y ceros finales.
      const igual = mismoValor(key, fila(antes)[key], value);
      if (!igual) throw new Error(`El movimiento ${antes.id} cambió desde la auditoría (${key}).`);
    }
    const origen = cuenta(d.cuenta || (antes.metodo_pago === "efectivo" ? "efectivo" : "principal"));
    if (antes.naturaleza && antes.naturaleza !== (original.categorias.find(c => c.id === base.categoria_id)?.tipo)) throw new Error(`El movimiento ${antes.id} ya fue reclasificado después de la auditoría.`);
    const partes = d.partes?.length ? d.partes : [{ monto: antes.monto, categoria: d.categoria, naturaleza: d.naturaleza, descripcion: antes.descripcion || "", requiere_revision: d.requiere_revision, motivo_revision: d.motivo_revision || undefined }];
    if (partes.reduce((s, p) => s + centavos(p.monto), 0) !== centavos(antes.monto)) throw new Error("El desglose no conserva el importe original.");
    partes.forEach((p, i) => {
      const c = categoria(p.categoria);
      const despues = { ...(i === 0 ? antes : {}), id: i === 0 ? antes.id : nuevoId(), user_id: userId, categoria_id: c.id, monto: p.monto, fecha: antes.fecha, metodo_pago: origen.metodo_pago, cuenta_id: origen.id, cuenta_destino_id: p.naturaleza === "traspaso" && d.destino ? cuenta(d.destino).id : null, naturaleza: p.naturaleza, descripcion: p.descripcion || antes.descripcion, etiquetas: [...new Set([...(antes.etiquetas || []), ...(d.etiquetas || [])])], requiere_revision: Boolean(p.requiere_revision), motivo_revision: p.requiere_revision ? p.motivo_revision || "Concepto por precisar" : null, cliente_id: antes.cliente_id || null, gasto_recurrente_id: antes.gasto_recurrente_id || null, ...(d.deuda_liquidada_en ? { deuda_liquidada_en: d.deuda_liquidada_en } : {}), ...(i ? { movimiento_relacionado_id: antes.id } : {}), ...(p.naturaleza !== "rendimiento" ? { interes_bruto: null, impuesto_retenido: null } : {}) } as Transaccion;
      plan.transacciones.push({ antes: i === 0 ? fila(antes) : null, despues: fila(despues) }); nuevas.push(despues);
    });
  }
  const traspasos = actual.transferencias.map(t => ({ ...t }));
  for (const antes of actual.transferencias) {
    const despues = { ...antes, cuenta_origen_id: cuenta(antes.origen === "efectivo" ? "efectivo" : "principal").id, cuenta_destino_id: cuenta(antes.destino === "efectivo" ? "efectivo" : "principal").id };
    plan.transferencias.push({ antes: fila(antes), despues: fila(despues) });
    traspasos.splice(traspasos.findIndex(t => t.id === antes.id), 1, despues);
  }
  for (const t of config.transferenciasNuevas) {
    const a = cuenta(t.origen), b = cuenta(t.destino);
    const despues: Transferencia = { id: nuevoId(), user_id: userId, monto: t.monto, fecha: t.fecha, descripcion: t.descripcion, origen: a.metodo_pago, destino: b.metodo_pago, cuenta_origen_id: a.id, cuenta_destino_id: b.id, creado_en: `${config.fecha}T18:00:00+00:00`, clave_solicitud: nuevoId() };
    plan.transferencias.push({ antes: null, despues: fila(despues) }); traspasos.push(despues);
  }
  for (const r of config.recurrentes) {
    const antes = actual.gastos_recurrentes.find(g => g.id === r.id); if (!antes) throw new Error("Un recurrente cambió desde la auditoría.");
    plan.gastos_recurrentes.push({ antes: fila(antes), despues: { id: antes.id, user_id: userId, categoria_id: categoria(r.categoria).id } });
  }
  const usadas = new Set([...destinoCategoria.values()].map(c => c.id));
  for (const antigua of original.categorias) if (!usadas.has(antigua.id)) {
    const antes = actual.categorias.find(c => c.id === antigua.id); if (!antes) throw new Error("Una categoría original cambió.");
    plan.categorias.push({ antes: fila(antes), despues: { id: antes.id, user_id: userId, archivada: true } });
  }
  const mapCat = new Map(categorias.map(c => [c.id, c]));
  const enriquecer = (filas: Transaccion[]): FilaFinanciera[] => filas.map(t => ({ ...t, categoria: mapCat.get(t.categoria_id) || null }));
  const fechaFin = new Date(`${config.fecha}T12:00:00Z`); fechaFin.setUTCDate(fechaFin.getUTCDate() + 1);
  const fin = fechaFin.toISOString().slice(0, 10);
  const antesLibro = resumirLibro(actual.cuentas_financieras, actual.transacciones.map(t => ({ ...t, categoria: actual.categorias.find(c => c.id === t.categoria_id) || null })), actual.transferencias, "2000-01-01", fin);
  const despuesLibro = resumirLibro(cuentas, enriquecer(nuevas), traspasos, "2000-01-01", fin);
  for (const codigo of ["principal", "efectivo"]) {
    const a = antesLibro.cuentas.find(c => c.codigo === codigo), b = despuesLibro.cuentas.find(c => c.codigo === codigo);
    if (!a || !b || centavos(a.saldo) !== centavos(b.saldo)) throw new Error(`La reclasificación alteraría el saldo físico de ${codigo}.`);
  }
  if (config.presupuestoInicial) {
    const meses = [...new Set(nuevas.map(t => t.fecha.slice(0, 7)).filter(m => m < config.fecha.slice(0, 7)))].sort().slice(-3);
    const ingresos = meses.map(m => nuevas.filter(t => t.fecha.startsWith(m) && t.naturaleza === "ingreso").reduce((s, t) => s + centavos(t.monto), 0) / 100).sort((a, b) => a - b);
    const baseIngreso = ingresos[Math.floor(ingresos.length / 2)] || 0;
    const bases = [...destinoCategoria.values()].filter(c => c.naturaleza === "egreso").map(c => {
      const gasto = meses.reduce((s, m) => s + nuevas.filter(t => t.categoria_id === c.id && t.fecha.startsWith(m) && ["egreso", "reembolso"].includes(t.naturaleza || "")).reduce((s, t) => s + centavos(t.monto) * (t.naturaleza === "reembolso" ? -1 : 1), 0), 0) / 100 / Math.max(1, meses.length);
      const recurrente = config.recurrentes.filter(r => categoria(r.categoria).id === c.id).reduce((s, r) => s + Number(actual.gastos_recurrentes.find(x => x.id === r.id)?.monto || 0), 0);
      return { categoria: c, base: Math.max(0, gasto, recurrente) };
    }).filter(b => b.base > 0);
    const fijo = bases.filter(b => b.categoria.grupo === "fijo").reduce((s, b) => s + b.base, 0);
    const variable = bases.filter(b => b.categoria.grupo !== "fijo").reduce((s, b) => s + b.base, 0);
    const factor = variable ? Math.min(1, Math.max(0, baseIngreso * .85 - fijo) / variable) : 1;
    const mes = config.fecha.slice(0, 7) + "-01";
    for (const b of bases) {
      if (actual.presupuestos.some(p => p.mes === mes && p.categoria_id === b.categoria.id)) continue;
      const limite = Math.max(10, Math.ceil(b.base * (b.categoria.grupo === "fijo" ? 1 : factor) / 10) * 10);
      plan.presupuestos.push({ antes: null, despues: { id: nuevoId(), user_id: userId, categoria_id: b.categoria.id, monto_limite: limite, mes } });
    }
  }
  if (config.meta && !actual.metas_ahorro.length) plan.metas_ahorro.push({ antes: null, despues: { id: nuevoId(), user_id: userId, nombre: config.meta.nombre, monto_objetivo: config.meta.objetivo, cuenta_id: cuenta(config.meta.cuenta).id, fecha_limite: null } });
  return { plan, antes: antesLibro, despues: despuesLibro, cobertura: { originales: original.transacciones.length, despues: nuevas.length, traspasos: traspasos.length, pendientes: despuesLibro.pendientes }, cuentas, transacciones: nuevas, transferencias: traspasos, categorias };
}
