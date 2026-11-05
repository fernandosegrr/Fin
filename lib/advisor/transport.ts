import type { ResultadoMensajeAsesor } from "./types";

export async function consultarAsesor(contenido: string, anio: number, mes: number, solicitudId: string, progreso: (estado: string) => void): Promise<ResultadoMensajeAsesor> {
  const response = await fetch("/api/asesor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contenido, anio, mes, solicitudId }) });
  if (!response.ok || !response.body) throw new Error(response.status === 401 ? "Tu sesión expiró." : "No se pudo iniciar la consulta. Reintenta para recuperar su estado.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let pendiente = ""; let resultado: ResultadoMensajeAsesor | null = null;
  function procesar(linea: string) {
    if (!linea.trim()) return;
    const evento = JSON.parse(linea);
    if (evento.tipo === "progreso") progreso(String(evento.estado));
    if (evento.tipo === "resultado") resultado = evento.resultado as ResultadoMensajeAsesor;
  }
  while (true) { const chunk = await reader.read(); if (chunk.done) break; pendiente += decoder.decode(chunk.value, { stream: true }); let indice; while ((indice = pendiente.indexOf("\n")) >= 0) { procesar(pendiente.slice(0, indice)); pendiente = pendiente.slice(indice + 1); } }
  pendiente += decoder.decode(); if (pendiente.trim()) procesar(pendiente);
  if (!resultado) throw new Error("La conexión se interrumpió. Reintenta el mismo mensaje para recuperar su resultado sin repetirlo.");
  return resultado;
}
