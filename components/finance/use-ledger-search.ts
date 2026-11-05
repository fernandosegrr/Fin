"use client";
import { useEffect, useRef, useState } from "react";
import { buscarHistorialFinanciero } from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { FiltrosLibro, ItemLibro } from "@/lib/dashboard/ledger";
import type { MetodoPago } from "@/lib/types";
import type { NaturalezaMovimiento } from "@/lib/finance/types";

export function useHistorySearch(abierto: boolean, onCerrar: () => void, inicial: FiltrosLibro = {}, refresh = 0, escapeActivo = true) {
  const [busqueda, setBusqueda] = useState(""); const [tipo, setTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [metodo, setMetodo] = useState<"todos" | MetodoPago>("todos"); const [cuentaId, setCuentaId] = useState("");
  const [categoriaId, setCategoriaId] = useState(""); const [naturaleza, setNaturaleza] = useState<NaturalezaMovimiento | "">("");
  const [desde, setDesde] = useState(""); const [hasta, setHasta] = useState(""); const [soloRevision, setSoloRevision] = useState(false);
  const [items, setItems] = useState<ItemLibro[]>([]); const [totalGeneral, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false); const [cargandoMas, setCargandoMas] = useState(false); const [error, setError] = useState<string | null>(null);
  const version = useRef(0); const inicialRef = useRef(inicial); inicialRef.current = inicial;
  useEscapeKey(abierto && escapeActivo, onCerrar);
  useEffect(() => { if (abierto) { const f = inicialRef.current; setBusqueda(f.busqueda || ""); setTipo(f.tipo || "todos"); setMetodo(f.metodoPago || "todos"); setCuentaId(f.cuentaId || ""); setCategoriaId(f.categoriaId || ""); setNaturaleza(f.naturaleza || ""); setDesde(f.desde || ""); setHasta(f.hasta || ""); setSoloRevision(Boolean(f.soloRevision)); } }, [abierto]);
  const filtros = { busqueda, tipo, metodoPago: metodo, cuentaId, categoriaId, naturaleza, desde, hasta, soloRevision };
  const firma = JSON.stringify(filtros); const firmaRef = useRef(firma); firmaRef.current = firma;
  useEffect(() => {
    const id = ++version.current; if (!abierto) return;
    let vigente = true;
    setCargando(true); setCargandoMas(false); setError(null);
    const timer = setTimeout(() => {
      buscarHistorialFinanciero({ ...JSON.parse(firma), offset: 0, limite: 50 }).then(r => { if (vigente && version.current === id) { setItems(r.filas); setTotal(r.total); } }).catch(e => { if (vigente && version.current === id) setError(e instanceof Error ? e.message : "No se pudo buscar."); }).finally(() => { if (vigente && version.current === id) setCargando(false); });
    }, 200);
    return () => { clearTimeout(timer); vigente = false; };
  }, [abierto, firma, refresh]);
  async function cargarMas() {
    if (cargando || cargandoMas || items.length >= totalGeneral) return;
    const id = version.current; const consulta = firmaRef.current; setCargandoMas(true);
    try { const r = await buscarHistorialFinanciero({ ...JSON.parse(consulta), offset: items.length, limite: 50 }); if (version.current !== id) return; setItems(prev => [...prev, ...r.filas.filter(f => !prev.some(p => p.key === f.key))]); setTotal(r.total); }
    catch (e) { if (version.current === id) setError(e instanceof Error ? e.message : "No se pudo cargar."); }
    finally { if (version.current === id) setCargandoMas(false); }
  }
  return { busqueda, setBusqueda, tipo, setTipo, metodo, setMetodo, cuentaId, setCuentaId, categoriaId, setCategoriaId, naturaleza, setNaturaleza, desde, setDesde, hasta, setHasta, soloRevision, setSoloRevision, cargando, cargandoMas, error, totalGeneral, hayMas: items.length < totalGeneral, items, cargarMas, filtros };
}
