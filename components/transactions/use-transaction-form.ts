"use client";

import { useEffect, useMemo, useState } from "react";
import { parsearMonto } from "@/lib/format";
import { hoyISOEnMexico } from "@/lib/dates";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { Categoria, MetodoPago, TipoCategoria, TransaccionConCategoria } from "@/lib/types";
import type { DatosNuevaTransaccion } from "./types";

interface Options {
  categorias: Categoria[];
  abierto: boolean;
  transaccionEditar?: TransaccionConCategoria | null;
  onCerrar: () => void;
  onEnviar: (datos: DatosNuevaTransaccion) => void;
  onEliminar?: (id: string) => void;
}

export function useTransactionForm({ categorias, abierto, transaccionEditar, onCerrar, onEnviar, onEliminar }: Options) {
  const [tipo, setTipo] = useState<TipoCategoria>("egreso");
  const [montoTexto, setMontoTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [clienteNuevo, setClienteNuevo] = useState("");

  const esEdicion = Boolean(transaccionEditar);

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.tipo === tipo),
    [categorias, tipo],
  );

  function cambiarTipo(nuevoTipo: TipoCategoria) {
    setTipo(nuevoTipo);
    setError(null);
    const primeraCat = categorias.find((c) => c.tipo === nuevoTipo);
    if (primeraCat) {
      setCategoriaId(primeraCat.id);
    } else {
      setCategoriaId("");
    }
  }

  useEffect(() => {
    if (!abierto) return;
    if (transaccionEditar) {
      const tTipo = transaccionEditar.categoria?.tipo || "egreso";
      setTipo(tTipo);
      setMontoTexto(String(transaccionEditar.monto));
      setCategoriaId(transaccionEditar.categoria_id);
      setDescripcion(transaccionEditar.descripcion || "");
      setMetodoPago(transaccionEditar.metodo_pago || "tarjeta");
      setFecha(transaccionEditar.fecha || "");
      setClienteId(transaccionEditar.cliente_id || transaccionEditar.cliente?.id || "");
      setClienteNuevo("");
    } else {
      setTipo("egreso");
      setMontoTexto("");
      setDescripcion("");
      setMetodoPago("tarjeta");
      setClienteId("");
      setClienteNuevo("");
      // Usar fecha de hoy por defecto en nuevas transacciones (zona horaria
      // de México, no UTC: pasadas las 18:00 UTC ya es "mañana" en UTC)
      setFecha(hoyISOEnMexico());
      const primeraEgreso = categorias.find((c) => c.tipo === "egreso");
      setCategoriaId(primeraEgreso?.id ?? "");
    }
    setError(null);
    // `categorias` a propósito fuera: si se incluye, crear una categoría
    // desde este modal resetea monto/fecha/descripción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, transaccionEditar]);

  useEscapeKey(abierto && !modalCategoriasAbierto, onCerrar);

  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(montoTexto);

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!categoriaId) {
      setError("Selecciona o crea una categoría.");
      return;
    }

    onEnviar({
      id: transaccionEditar?.id,
      tipo,
      categoria_id: categoriaId,
      monto,
      descripcion: descripcion.trim() || null,
      metodo_pago: metodoPago,
      fecha: fecha || undefined,
      cliente_id: tipo === "ingreso" ? clienteId || null : null,
      cliente_nuevo: tipo === "ingreso" && !clienteId ? clienteNuevo.trim() || null : null,
    });
    onCerrar();
  }

  function manejarEliminar() {
    if (transaccionEditar && onEliminar) {
      if (confirm("¿Estás seguro de que deseas eliminar este movimiento?")) {
        onEliminar(transaccionEditar.id);
        onCerrar();
      }
    }
  }

  return {
    tipo, montoTexto, setMontoTexto, categoriaId, setCategoriaId, descripcion, setDescripcion,
    metodoPago, setMetodoPago, fecha, setFecha, error, modalCategoriasAbierto, setModalCategoriasAbierto,
    clienteId, setClienteId, clienteNuevo, setClienteNuevo, esEdicion, categoriasFiltradas,
    cambiarTipo, manejarEnvio, manejarEliminar,
  };
}
