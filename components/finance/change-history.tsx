"use client";
import { useState } from "react";
import { obtenerCambiosFinancieros, revertirLoteFinanciero } from "@/app/dashboard/actions";

export function ChangeHistory({ onCambio }: { onCambio: () => void }) {
  const [filas, setFilas] = useState<Awaited<ReturnType<typeof obtenerCambiosFinancieros>>>([]);
  const [error, setError] = useState<string | null>(null); const [cargando, setCargando] = useState(false);
  async function cargar() { setCargando(true); setError(null); try { setFilas(await obtenerCambiosFinancieros()); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar."); } finally { setCargando(false); } }
  return <details className="finance-card p-4 sm:p-5" onToggle={e => { if (e.currentTarget.open && !filas.length && !cargando) void cargar(); }}>
    <summary className="font-bold cursor-pointer">Historial de cambios y reclasificaciones</summary>
    <p className="text-xs text-[#5E7165] mt-3">Puedes deshacer un lote si sus registros no tienen modificaciones posteriores. Se comprueba todo antes de restaurar.</p>
    {error && <p role="alert" className="text-xs text-[#AA524A] my-3">{error}</p>}
    {cargando && <p className="text-xs mt-3" role="status">Cargando…</p>}
    <div className="mt-3 divide-y divide-[#DCE4DB]">{filas.map(f => <div key={f.id} className="flex justify-between gap-3 py-3 text-xs"><div><p className="font-semibold">{f.nombre}</p><p className="text-[#5E7165] mt-1">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(f.creado_en))}{f.revertido ? " · revertido" : ""}</p></div>{!f.revertido && <button className="text-[#286F50] underline font-semibold shrink-0" disabled={cargando} onClick={async () => { if (!confirm(`¿Deshacer “${f.nombre}”? Se restaurarán sus registros anteriores.`)) return; setCargando(true); setError(null); try { await revertirLoteFinanciero(f.id); onCambio(); await cargar(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo deshacer."); } finally { setCargando(false); } }}>Deshacer</button>}</div>)}</div>
  </details>;
}
