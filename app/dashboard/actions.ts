"use server";

import * as domainAuth from "@/lib/dashboard/auth";
import * as domainCategories from "@/lib/dashboard/categories";
import * as domainTransactions from "@/lib/dashboard/transactions";
import * as domainTransfers from "@/lib/dashboard/transfers";
import * as domainBalance from "@/lib/dashboard/balance";
import * as domainBudgets from "@/lib/dashboard/budgets";
import * as domainRecurring from "@/lib/dashboard/recurring";
import * as domainClients from "@/lib/dashboard/clients";
import * as domainGoals from "@/lib/dashboard/goals";
import * as domainDashboard from "@/lib/dashboard/dashboard";
import * as domainHistory from "@/lib/dashboard/history";
import * as domainAccounts from "@/lib/dashboard/accounts";
import * as domainAudit from "@/lib/dashboard/audit";
import * as domainLedger from "@/lib/dashboard/ledger";

export async function obtenerCuentas() { return domainAccounts.obtenerCuentas(); }
export async function guardarCuenta(...args: Parameters<typeof domainAccounts.guardarCuenta>) { return domainAccounts.guardarCuenta(...args); }
export async function registrarRendimiento(...args: Parameters<typeof domainAccounts.registrarRendimiento>) { return domainAccounts.registrarRendimiento(...args); }
export async function ajustarSaldoCuenta(...args: Parameters<typeof domainAccounts.ajustarSaldoCuenta>) { return domainAccounts.ajustarSaldoCuenta(...args); }
export async function restaurarTransferencia(...args: Parameters<typeof domainTransfers.restaurarTransferencia>) { return domainTransfers.restaurarTransferencia(...args); }
export async function obtenerCambiosFinancieros() { return domainAudit.obtenerCambiosFinancieros(); }
export async function revertirLoteFinanciero(...args: Parameters<typeof domainAudit.revertirLoteFinanciero>) { return domainAudit.revertirLoteFinanciero(...args); }
export async function buscarHistorialFinanciero(...args: Parameters<typeof domainLedger.buscarHistorialFinanciero>) { return domainLedger.buscarHistorialFinanciero(...args); }
export async function obtenerInformeFinanciero(...args: Parameters<typeof domainLedger.obtenerInformeFinanciero>) { return domainLedger.obtenerInformeFinanciero(...args); }
export async function obtenerDeudasPendientes() { return (await domainLedger.obtenerInformeFinanciero()).resumen.deudasPendientes; }

export type { CrearCategoriaInput } from "@/lib/dashboard/categories";
export type { NuevaTransaccion, ActualizarTransaccionInput } from "@/lib/dashboard/transactions";
export type { NuevaTransferencia, ActualizarTransferenciaInput } from "@/lib/dashboard/transfers";
export type { BalanceMensual } from "@/lib/dashboard/balance";
export type { PresupuestoEntrada, ResultadoCopiaPresupuestos } from "@/lib/dashboard/budgets";
export type { NuevoGastoRecurrente, ResultadoAjusteSaldo } from "@/lib/dashboard/recurring";
export type { ResultadoMetaAhorro } from "@/lib/dashboard/goals";
export type { DatosDashboard } from "@/lib/dashboard/dashboard";

export async function signOut(...args: Parameters<typeof domainAuth.signOut>) {
  return domainAuth.signOut(...args);
}

export async function obtenerCategorias(...args: Parameters<typeof domainCategories.obtenerCategorias>) {
  return domainCategories.obtenerCategorias(...args);
}

export async function crearCategoria(...args: Parameters<typeof domainCategories.crearCategoria>) {
  return domainCategories.crearCategoria(...args);
}

export async function eliminarCategoria(...args: Parameters<typeof domainCategories.eliminarCategoria>) {
  return domainCategories.eliminarCategoria(...args);
}
export async function actualizarCategoria(...args: Parameters<typeof domainCategories.actualizarCategoria>) { return domainCategories.actualizarCategoria(...args); }
export async function fusionarCategorias(...args: Parameters<typeof domainCategories.fusionarCategorias>) { return domainCategories.fusionarCategorias(...args); }

export async function crearTransaccion(...args: Parameters<typeof domainTransactions.crearTransaccion>) {
  return domainTransactions.crearTransaccion(...args);
}

export async function actualizarTransaccion(...args: Parameters<typeof domainTransactions.actualizarTransaccion>) {
  return domainTransactions.actualizarTransaccion(...args);
}

export async function eliminarTransaccion(...args: Parameters<typeof domainTransactions.eliminarTransaccion>) {
  return domainTransactions.eliminarTransaccion(...args);
}
export async function restaurarTransaccion(...args: Parameters<typeof domainTransactions.restaurarTransaccion>) { return domainTransactions.restaurarTransaccion(...args); }

export async function crearTransferencia(...args: Parameters<typeof domainTransfers.crearTransferencia>) {
  return domainTransfers.crearTransferencia(...args);
}

export async function actualizarTransferencia(...args: Parameters<typeof domainTransfers.actualizarTransferencia>) {
  return domainTransfers.actualizarTransferencia(...args);
}

export async function eliminarTransferencia(...args: Parameters<typeof domainTransfers.eliminarTransferencia>) {
  return domainTransfers.eliminarTransferencia(...args);
}

export async function obtenerBalanceMensual(...args: Parameters<typeof domainBalance.obtenerBalanceMensual>) {
  return domainBalance.obtenerBalanceMensual(...args);
}

export async function obtenerTransaccionesCompletasDelMes(...args: Parameters<typeof domainBalance.obtenerTransaccionesCompletasDelMes>) {
  return domainBalance.obtenerTransaccionesCompletasDelMes(...args);
}

export async function obtenerTransferenciasCompletasDelMes(...args: Parameters<typeof domainBalance.obtenerTransferenciasCompletasDelMes>) {
  return domainBalance.obtenerTransferenciasCompletasDelMes(...args);
}

export async function obtenerPresupuestosConGasto(...args: Parameters<typeof domainBudgets.obtenerPresupuestosConGasto>) {
  return domainBudgets.obtenerPresupuestosConGasto(...args);
}

export async function guardarPresupuesto(...args: Parameters<typeof domainBudgets.guardarPresupuesto>) {
  return domainBudgets.guardarPresupuesto(...args);
}

export async function guardarPresupuestosMultiples(...args: Parameters<typeof domainBudgets.guardarPresupuestosMultiples>) {
  return domainBudgets.guardarPresupuestosMultiples(...args);
}

export async function copiarPresupuestosMesAnterior(...args: Parameters<typeof domainBudgets.copiarPresupuestosMesAnterior>) {
  return domainBudgets.copiarPresupuestosMesAnterior(...args);
}

export async function obtenerGastosRecurrentes(...args: Parameters<typeof domainRecurring.obtenerGastosRecurrentes>) {
  return domainRecurring.obtenerGastosRecurrentes(...args);
}

export async function crearGastoRecurrente(...args: Parameters<typeof domainRecurring.crearGastoRecurrente>) {
  return domainRecurring.crearGastoRecurrente(...args);
}

export async function actualizarGastoRecurrente(...args: Parameters<typeof domainRecurring.actualizarGastoRecurrente>) {
  return domainRecurring.actualizarGastoRecurrente(...args);
}

export async function eliminarGastoRecurrente(...args: Parameters<typeof domainRecurring.eliminarGastoRecurrente>) {
  return domainRecurring.eliminarGastoRecurrente(...args);
}

export async function ajustarSaldo(...args: Parameters<typeof domainRecurring.ajustarSaldo>) {
  return domainRecurring.ajustarSaldo(...args);
}

export async function obtenerClientes(...args: Parameters<typeof domainClients.obtenerClientes>) {
  return domainClients.obtenerClientes(...args);
}

export async function crearCliente(...args: Parameters<typeof domainClients.crearCliente>) {
  return domainClients.crearCliente(...args);
}

export async function eliminarCliente(...args: Parameters<typeof domainClients.eliminarCliente>) {
  return domainClients.eliminarCliente(...args);
}

export async function obtenerMetaAhorro(...args: Parameters<typeof domainGoals.obtenerMetaAhorro>) {
  return domainGoals.obtenerMetaAhorro(...args);
}

export async function guardarMetaAhorro(...args: Parameters<typeof domainGoals.guardarMetaAhorro>) {
  return domainGoals.guardarMetaAhorro(...args);
}

export async function eliminarMetaAhorro(...args: Parameters<typeof domainGoals.eliminarMetaAhorro>) {
  return domainGoals.eliminarMetaAhorro(...args);
}

export async function obtenerDatosDashboard(...args: Parameters<typeof domainDashboard.obtenerDatosDashboard>) {
  return domainDashboard.obtenerDatosDashboard(...args);
}

export async function buscarTransacciones(...args: Parameters<typeof domainHistory.buscarTransacciones>) {
  return domainHistory.buscarTransacciones(...args);
}

export async function buscarTransferencias(...args: Parameters<typeof domainHistory.buscarTransferencias>) {
  return domainHistory.buscarTransferencias(...args);
}
