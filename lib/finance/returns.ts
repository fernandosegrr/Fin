import { centavos, naturalezaDe, resumirLibro } from "./ledger";
import type { CuentaConSaldo, CuentaFinanciera, FilaFinanciera, TraspasoFinanciero } from "./types";

const PRECISION = BigInt(1_000_000_000);
const CIEN = BigInt(100);
const BPS = BigInt(10_000);
const BASE_INTERES = BigInt(360);
const BASE_IMPUESTO = BigInt(365);

export interface ProyeccionCuenta {
  cuentaId: string;
  nombre: string;
  saldo: number;
  tasaPonderada: number;
  bruto: number;
  retencion: number;
  neto: number;
  saldoProyectado: number;
}

/** Proyección, nunca una acreditación. Conserva fracciones de centavo y capitaliza el neto. */
export function proyectarRendimientos(cuentas: CuentaConSaldo[], dias: number, fechaInicio: string): ProyeccionCuenta[] {
  if (!Number.isInteger(dias) || dias < 1 || dias > 366) throw new Error("El periodo de proyección no es válido.");
  const simulador = crearSimulador(cuentas);
  for (let dia = 0; dia < dias; dia++) simulador.avanzar(sumarDias(fechaInicio, dia));
  return simulador.resultados();
}

function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}

function crearSimulador(cuentas: CuentaConSaldo[], desdePorCuenta = new Map<string, string>()) {
  const fondos = cuentas.filter(c => c.grupo_rendimiento && c.rendimiento_desde && !c.archivada);
  const estados = fondos.map(c => ({
    cuenta: c, saldo: BigInt(centavos(c.saldo)), inicial: BigInt(centavos(c.saldo)),
    residuoInteres: BigInt(0), residuoImpuesto: BigInt(0), bruto: BigInt(0), impuesto: BigInt(0), tasa: 0,
  }));
  const grupos = new Map<string, typeof estados>();
  for (const e of estados) {
    const clave = `${e.cuenta.user_id}:${e.cuenta.grupo_rendimiento}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
  }
  function avanzar(iso: string) {
    for (const grupo of grupos.values()) {
      const activos = grupo.filter(e => e.cuenta.rendimiento_desde! <= iso && e.saldo > BigInt(0));
      const total = activos.reduce((s, e) => s + e.saldo, BigInt(0));
      if (total <= BigInt(0)) continue;
      const config = activos[0].cuenta;
      // Los apartados de un producto comparten límites y una tasa ponderada.
      if (activos.some(e => ["tasa_anual", "tasa_excedente", "tasa_superior", "limite_preferente", "limite_segundo_tramo"].some(k => Number(e.cuenta[k as keyof CuentaConSaldo]) !== Number(config[k as keyof CuentaConSaldo])))) {
        throw new Error("Los apartados del mismo producto deben compartir tasas y límites.");
      }
      const primero = BigInt(centavos(config.limite_preferente));
      const segundo = BigInt(centavos(config.limite_segundo_tramo));
      const tramo1 = total < primero ? total : primero;
      const sobre1 = total > primero ? total - primero : BigInt(0);
      const capacidad2 = segundo - primero;
      const tramo2 = sobre1 < capacidad2 ? sobre1 : capacidad2;
      const tramo3 = total > segundo ? total - segundo : BigInt(0);
      const ponderado = tramo1 * BigInt(Math.round(config.tasa_anual * 100))
        + tramo2 * BigInt(Math.round(config.tasa_excedente * 100))
        + tramo3 * BigInt(Math.round(config.tasa_superior * 100));
      for (const e of activos) {
        if ((desdePorCuenta.get(e.cuenta.id) || e.cuenta.rendimiento_desde!) > iso) continue;
        const devengado = e.saldo * ponderado * PRECISION / (total * BPS * BASE_INTERES);
        const impuesto = e.saldo * BigInt(Math.round(e.cuenta.retencion_anual * 100)) * PRECISION / (BPS * BASE_IMPUESTO);
        e.residuoInteres += devengado;
        e.residuoImpuesto += impuesto;
        const pago = e.residuoInteres / PRECISION;
        const retenido = e.residuoImpuesto / PRECISION;
        e.residuoInteres %= PRECISION; e.residuoImpuesto %= PRECISION;
        e.bruto += pago; e.impuesto += retenido; e.saldo += pago - retenido;
        e.tasa = Number(ponderado * CIEN / total) / 10_000;
      }
    }
  }
  function resultados() { return estados.map(e => ({
    cuentaId: e.cuenta.id, nombre: e.cuenta.nombre, saldo: Number(e.inicial) / 100,
    tasaPonderada: e.tasa, bruto: Number(e.bruto) / 100, retencion: Number(e.impuesto) / 100,
    neto: Number(e.bruto - e.impuesto) / 100, saldoProyectado: Number(e.saldo) / 100,
  })); }
  function actualizarSaldos(cuentasDia: CuentaConSaldo[]) {
    const saldos = new Map(cuentasDia.map(c => [c.id, c.saldo]));
    for (const e of estados) e.saldo = BigInt(centavos(saldos.get(e.cuenta.id) || 0)) + e.bruto - e.impuesto;
  }
  return { avanzar, resultados, actualizarSaldos };
}

export interface EstimacionAcumulada {
  hasta: string;
  desdePorCuenta: Record<string, string>;
  cuentas: ProyeccionCuenta[];
}

/** Interés aún no confirmado, al inicio de `hasta`. No crea asientos.
 * Un abono real o una conciliación ancla el cálculo de nuevo en cada cuenta.
 * Los movimientos diarios y el límite conjunto se consideran antes de devengar.
 */
export function estimarRendimientosPendientes(cuentas: CuentaFinanciera[], filas: FilaFinanciera[], traspasos: TraspasoFinanciero[], hasta: string): EstimacionAcumulada {
  const vigentes = filas.filter(t => !t.eliminado_en && t.fecha <= hasta);
  const desde = new Map(cuentas.filter(c => c.grupo_rendimiento && c.rendimiento_desde && !c.archivada).map(c => [c.id, c.rendimiento_desde!]));
  for (const t of vigentes) {
    const n = naturalezaDe(t);
    if (!["rendimiento", "ajuste_entrada", "ajuste_salida"].includes(n)) continue;
    const id = t.cuenta_id || cuentas.find(c => c.codigo === (t.metodo_pago === "efectivo" ? "efectivo" : "principal"))?.id;
    if (id && desde.has(id) && t.fecha > desde.get(id)!) desde.set(id, t.fecha);
  }
  const resumen = (fin: string) => resumirLibro(cuentas, vigentes, traspasos, "2000-01-01", fin).cuentas;
  const saldos = resumen(sumarDias(hasta, 1));
  const simulador = crearSimulador(saldos, desde);
  const inicio = [...desde.values()].sort()[0] || hasta;
  if ((Date.parse(hasta) - Date.parse(inicio)) / 86400000 > 3660) throw new Error("Concilia el saldo de la cuenta para actualizar una estimación de más de diez años.");
  for (let dia = inicio; dia < hasta; dia = sumarDias(dia, 1)) {
    simulador.actualizarSaldos(resumen(sumarDias(dia, 1)));
    simulador.avanzar(dia);
  }
  simulador.actualizarSaldos(saldos);
  return { hasta, desdePorCuenta: Object.fromEntries(desde), cuentas: simulador.resultados() };
}
