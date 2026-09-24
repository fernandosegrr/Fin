"use server";

import * as advisorHistory from "@/lib/advisor/history";
import * as advisorMessage from "@/lib/advisor/message";
export type { ResultadoHistorialAsesor, ResultadoMensajeAsesor, ResultadoBorrarHistorialAsesor } from "@/lib/advisor/types";

export async function obtenerHistorialAsesor(...args: Parameters<typeof advisorHistory.obtenerHistorialAsesor>) {
  return advisorHistory.obtenerHistorialAsesor(...args);
}

export async function borrarHistorialAsesor(...args: Parameters<typeof advisorHistory.borrarHistorialAsesor>) {
  return advisorHistory.borrarHistorialAsesor(...args);
}

export async function enviarMensajeAsesor(...args: Parameters<typeof advisorMessage.enviarMensajeAsesor>) {
  return advisorMessage.enviarMensajeAsesor(...args);
}
