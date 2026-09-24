"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buscarTransacciones, buscarTransferencias } from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { MetodoPago, TipoCategoria, TransaccionConCategoria, Transferencia } from "@/lib/types";

type ItemHistorial =
  | { clase: "transaccion"; key: string; fecha: string; creadoEn: string; data: TransaccionConCategoria }
  | { clase: "transferencia"; key: string; fecha: string; creadoEn: string; data: Transferencia };

export function useHistorySearch(abierto: boolean, onCerrar: () => void) {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<"todos" | TipoCategoria>("todos");
  const [metodo, setMetodo] = useState<"todos" | MetodoPago>("todos");
  const [filas, setFilas] = useState<TransaccionConCategoria[]>([]);
  const [total, setTotal] = useState(0);
  const [filasTraspasos, setFilasTraspasos] = useState<Transferencia[]>([]);
  const [totalTraspasos, setTotalTraspasos] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consultaActual = `${abierto}:${busqueda}:${tipo}:${metodo}`;
  const consultaActualRef = useRef(consultaActual);
  const consultaVersionRef = useRef(0);
  consultaActualRef.current = consultaActual;

  useEscapeKey(abierto, onCerrar);

  const incluirTraspasos = tipo === "todos";
  const totalGeneral = total + (incluirTraspasos ? totalTraspasos : 0);
  const hayMas = filas.length < total || (incluirTraspasos && filasTraspasos.length < totalTraspasos);

  useEffect(() => {
    consultaVersionRef.current += 1;
    if (!abierto) return;
    let cancelado = false;
    setCargando(true);
    setCargandoMas(false);
    setError(null);
    const t = setTimeout(() => {
      Promise.all([
        buscarTransacciones({ busqueda, tipo, metodoPago: metodo, limite: 50, offset: 0 }),
        incluirTraspasos
          ? buscarTransferencias({ busqueda, metodoPago: metodo, limite: 50, offset: 0 })
          : Promise.resolve({ filas: [] as Transferencia[], total: 0 }),
      ])
        .then(([rTx, rTr]) => {
          if (cancelado) return;
          setFilas(rTx.filas);
          setTotal(rTx.total);
          setFilasTraspasos(rTr.filas);
          setTotalTraspasos(rTr.total);
        })
        .catch((err) => {
          if (!cancelado) setError(err instanceof Error ? err.message : "No se pudo buscar.");
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [abierto, busqueda, tipo, metodo, incluirTraspasos]);

  async function cargarMas() {
    if (!abierto || cargando || cargandoMas || !hayMas) return;
    const consulta = consultaActual;
    const version = consultaVersionRef.current;
    setCargandoMas(true);
    setError(null);
    try {
      const [rTx, rTr] = await Promise.all([
        filas.length < total
          ? buscarTransacciones({ busqueda, tipo, metodoPago: metodo, limite: 50, offset: filas.length })
          : Promise.resolve({ filas: [] as TransaccionConCategoria[], total }),
        incluirTraspasos && filasTraspasos.length < totalTraspasos
          ? buscarTransferencias({ busqueda, metodoPago: metodo, limite: 50, offset: filasTraspasos.length })
          : Promise.resolve({ filas: [] as Transferencia[], total: totalTraspasos }),
      ]);
      if (consultaActualRef.current !== consulta || consultaVersionRef.current !== version) return;
      setFilas((prev) => [...prev, ...rTx.filas]);
      setTotal(rTx.total);
      setFilasTraspasos((prev) => [...prev, ...rTr.filas]);
      setTotalTraspasos(rTr.total);
    } catch (err) {
      if (consultaActualRef.current === consulta && consultaVersionRef.current === version) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar más movimientos.");
      }
    } finally {
      if (consultaActualRef.current === consulta && consultaVersionRef.current === version) setCargandoMas(false);
    }
  }

  const items = useMemo(() => {
    const lista: ItemHistorial[] = [
      ...filas.map((t) => ({ clase: "transaccion" as const, key: `tx-${t.id}`, fecha: t.fecha, creadoEn: t.creado_en, data: t })),
      ...filasTraspasos.map((t) => ({ clase: "transferencia" as const, key: `tr-${t.id}`, fecha: t.fecha, creadoEn: t.creado_en, data: t })),
    ];
    lista.sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
      return a.creadoEn < b.creadoEn ? 1 : -1;
    });
    return lista;
  }, [filas, filasTraspasos]);

  return {
    busqueda, setBusqueda, tipo, setTipo, metodo, setMetodo, cargando, cargandoMas, error,
    totalGeneral, hayMas, items, cargarMas,
  };
}
