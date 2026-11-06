import type { Categoria, MetodoPago, TransaccionConCategoria, Transferencia } from "@/lib/types";

export const NATURALEZAS = ["ingreso", "egreso", "apoyo", "rendimiento", "retencion", "reembolso", "financiacion", "pago_deuda", "ajuste_entrada", "ajuste_salida", "traspaso", "ingreso_pendiente", "egreso_pendiente"] as const;
export type NaturalezaMovimiento = typeof NATURALEZAS[number];
export const NOMBRES_NATURALEZA: Record<NaturalezaMovimiento, string> = {
  ingreso: "Ingreso por trabajo", egreso: "Gasto", apoyo: "Apoyo recibido", rendimiento: "Rendimiento",
  retencion: "Retención / impuesto", reembolso: "Reembolso", financiacion: "Préstamo recibido",
  pago_deuda: "Pago de deuda", ajuste_entrada: "Ajuste positivo", ajuste_salida: "Ajuste negativo",
  traspaso: "Traspaso propio", ingreso_pendiente: "Entrada por identificar", egreso_pendiente: "Salida por identificar",
};

export interface CuentaFinanciera {
  id: string;
  user_id: string;
  codigo: string;
  nombre: string;
  tipo: "efectivo" | "principal" | "ahorro" | "reserva";
  metodo_pago: MetodoPago;
  banco: string | null;
  excluida_disponible: boolean;
  archivada: boolean;
  grupo_rendimiento: string | null;
  rendimiento_desde: string | null;
  tasa_anual: number;
  tasa_excedente: number;
  tasa_superior: number;
  retencion_anual: number;
  limite_preferente: number;
  limite_segundo_tramo: number;
  plan: string | null;
}

export interface CuentaConSaldo extends CuentaFinanciera {
  saldo: number;
  saldoInicial: number;
  variacion: number;
  rendimientosMes: number;
  retencionesMes: number;
}

export type FilaFinanciera = TransaccionConCategoria & {
  naturaleza?: NaturalezaMovimiento | null;
  cuenta_id?: string | null;
  cuenta_destino_id?: string | null;
  etiquetas?: string[];
  requiere_revision?: boolean;
  motivo_revision?: string | null;
  interes_bruto?: number | null;
  impuesto_retenido?: number | null;
  deuda_liquidada_en?: string | null;
  eliminado_en?: string | null;
};

export interface ResumenFinanciero {
  gastosDestino?: { mes: import("./spending").ResumenGastosDestino; historico: import("./spending").ResumenGastosDestino };
  estimacionRendimientos?: import("./returns").EstimacionAcumulada;
  cuentas: CuentaConSaldo[];
  disponible: number;
  ahorro: number;
  patrimonio: number;
  deuda: number;
  deudasPendientes: { id: string; descripcion: string; fecha: string; recibido: number; pendiente: number }[];
  activos: number;
  ingresosTrabajo: number;
  apoyos: number;
  rendimientosNetos: number;
  rendimientosBrutos: number;
  rendimientosSinDesglose: { cantidad: number; neto: number };
  retenciones: number;
  consumo: number;
  reembolsos: number;
  prestamosRecibidos: number;
  pagosDeuda: number;
  ajustes: number;
  entradasPorIdentificar: number;
  salidasPorIdentificar: number;
  aportacionesAhorro: number;
  retirosAhorro: number;
  pendientes: number;
  historicoIngresos: { trabajo: number; apoyos: number; rendimientos: number; total: number; entradas: number; desde: string | null };
  compras: { cantidad: number; promedio: number; mayores: TransaccionConCategoria[] };
}

export type CategoriaFinanciera = Categoria & { familia?: string | null; archivada?: boolean; naturaleza?: NaturalezaMovimiento | null; aliases?: string[] };
export type TraspasoFinanciero = Transferencia & { cuenta_origen_id?: string | null; cuenta_destino_id?: string | null; eliminado_en?: string | null };
