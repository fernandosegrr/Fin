"use client";

import { startTransition, useOptimistic, useState, useMemo } from "react";
import { crearTransaccion, actualizarTransaccion, eliminarTransaccion, crearCliente } from "@/app/dashboard/actions";
import { hoyISOEnMexico } from "@/lib/dates";
import { formatearMonto } from "@/lib/format";
import type { Categoria, Cliente, MetodoPago, TransaccionConCategoria } from "@/lib/types";
import type { DatosNuevaTransaccion } from "./types";
import { filterTransactions } from "./filter-transactions";

interface Options {
  initialTransacciones: TransaccionConCategoria[];
  categorias: Categoria[];
  clientes: Cliente[];
  onTransaccionCambiada?: (mensajeToast?: { texto: string; tipo?: "success" | "error" | "info" }) => void;
}

type TransaccionOptimista = TransaccionConCategoria & { pendiente?: boolean };
let contadorOptimista = 0;

export function useTransactions({ initialTransacciones, categorias, clientes, onTransaccionCambiada }: Options) {
  const [modalCapturaAbierto, setModalCapturaAbierto] = useState(false);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);
  const [transaccionAEditar, setTransaccionAEditar] = useState<TransaccionConCategoria | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [filtroMetodo, setFiltroMetodo] = useState<"todos" | MetodoPago>("todos");

  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [transacciones, setTransaccionesOptimista] = useOptimistic<
    TransaccionOptimista[],
    { accion: "crear" | "actualizar" | "eliminar"; item: TransaccionOptimista }
  >(initialTransacciones, (estado, payload) => {
    if (payload.accion === "crear") {
      return [payload.item, ...estado];
    }
    if (payload.accion === "actualizar") {
      return estado.map((t) => (t.id === payload.item.id ? payload.item : t));
    }
    if (payload.accion === "eliminar") {
      return estado.filter((t) => t.id !== payload.item.id);
    }
    return estado;
  });

  // Filtrado de transacciones
  const transaccionesFiltradas = useMemo(
    () => filterTransactions(transacciones, { busqueda, tipo: filtroTipo, metodo: filtroMetodo }),
    [transacciones, busqueda, filtroTipo, filtroMetodo],
  );

  async function resolverClienteId(datos: DatosNuevaTransaccion): Promise<string | null> {
    if (datos.tipo !== "ingreso") return null;
    if (datos.cliente_id) return datos.cliente_id;
    if (datos.cliente_nuevo?.trim()) {
      const creado = await crearCliente(datos.cliente_nuevo.trim());
      return creado.id;
    }
    return null;
  }

  function manejarEnvio(datos: DatosNuevaTransaccion) {
    const categoria = categorias.find((c) => c.id === datos.categoria_id) ?? null;
    contadorOptimista += 1;

    const esIngreso = datos.tipo === "ingreso";
    const cliente = esIngreso
      ? clientes.find((c) => c.id === datos.cliente_id) ??
        (datos.cliente_nuevo?.trim() ? { id: "nuevo", nombre: datos.cliente_nuevo.trim() } : null)
      : null;

    if (datos.id) {
      // Editar
      const anterior = transacciones.find((t) => t.id === datos.id);
      const actualizada: TransaccionOptimista = {
        ...anterior,
        id: datos.id,
        user_id: anterior?.user_id ?? "",
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        metodo_pago: datos.metodo_pago,
        fecha: datos.fecha || anterior?.fecha || hoyISOEnMexico(),
        descripcion: datos.descripcion,
        creado_en: anterior?.creado_en ?? "",
        categoria: categoria
          ? { id: categoria.id, nombre: categoria.nombre, tipo: categoria.tipo, grupo: categoria.grupo }
          : null,
        cliente_id: cliente?.id ?? null,
        cliente,
        pendiente: true,
      };

      setErrorEnvio(null);
      startTransition(async () => {
        setTransaccionesOptimista({ accion: "actualizar", item: actualizada });
        try {
          const clienteId = await resolverClienteId(datos);
          await actualizarTransaccion(datos.id!, {
            categoria_id: datos.categoria_id,
            monto: datos.monto,
            descripcion: datos.descripcion,
            metodo_pago: datos.metodo_pago,
            fecha: datos.fecha,
            cliente_id: clienteId,
          });
          onTransaccionCambiada?.({
            texto: `¡Movimiento de ${formatearMonto(datos.monto)} actualizado con éxito! ✏️`,
            tipo: "success",
          });
        } catch (err) {
          setErrorEnvio(err instanceof Error ? err.message : "Error al actualizar.");
        }
      });
    } else {
      // Crear
      const fecha = datos.fecha || hoyISOEnMexico();
      const nueva: TransaccionOptimista = {
        id: `optimista-${contadorOptimista}`,
        user_id: "",
        categoria_id: datos.categoria_id,
        monto: datos.monto,
        metodo_pago: datos.metodo_pago,
        fecha,
        descripcion: datos.descripcion,
        creado_en: "",
        categoria: categoria
          ? { id: categoria.id, nombre: categoria.nombre, tipo: categoria.tipo, grupo: categoria.grupo }
          : null,
        cliente_id: cliente?.id ?? null,
        cliente,
        pendiente: true,
      };

      setErrorEnvio(null);
      startTransition(async () => {
        setTransaccionesOptimista({ accion: "crear", item: nueva });
        try {
          const clienteId = await resolverClienteId(datos);
          await crearTransaccion({
            categoria_id: datos.categoria_id,
            monto: datos.monto,
            descripcion: datos.descripcion,
            metodo_pago: datos.metodo_pago,
            fecha,
            cliente_id: clienteId,
          });
          onTransaccionCambiada?.({
            texto: esIngreso
              ? `¡Ingreso de ${formatearMonto(datos.monto)} registrado! 💰`
              : `¡Egreso de ${formatearMonto(datos.monto)} registrado! 🧾`,
            tipo: "success",
          });
        } catch (err) {
          setErrorEnvio(err instanceof Error ? err.message : "Error al guardar el movimiento.");
        }
      });
    }
  }

  function manejarEliminar(id: string) {
    const itemEliminar = transacciones.find((t) => t.id === id);
    if (!itemEliminar) return;

    setErrorEnvio(null);
    startTransition(async () => {
      setTransaccionesOptimista({ accion: "eliminar", item: itemEliminar });
      try {
        await eliminarTransaccion(id);
        onTransaccionCambiada?.({
          texto: "¡Movimiento eliminado con éxito! 🗑️",
          tipo: "info",
        });
      } catch (err) {
        setErrorEnvio(err instanceof Error ? err.message : "No se pudo eliminar el movimiento.");
      }
    });
  }

  function abrirEdicion(t: TransaccionConCategoria) {
    setTransaccionAEditar(t);
    setModalCapturaAbierto(true);
  }

  function abrirNuevo() {
    setTransaccionAEditar(null);
    setModalCapturaAbierto(true);
  }

  return {
    modalCapturaAbierto, setModalCapturaAbierto, modalCategoriasAbierto, setModalCategoriasAbierto,
    transaccionAEditar, busqueda, setBusqueda, filtroTipo, setFiltroTipo, filtroMetodo, setFiltroMetodo,
    errorEnvio, transacciones, transaccionesFiltradas, manejarEnvio, manejarEliminar, abrirEdicion, abrirNuevo,
  };
}
