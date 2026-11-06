"use client";

import { startTransition, useEffect, useRef, useMemo, useOptimistic, useState } from "react";
import { parsearMonto, capitalizarPrimeraLetra } from "@/lib/format";
import { hoyEnMexico, hoyISOEnMexico, nombreDelMes } from "@/lib/dates";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { Categoria, GastoRecurrente, MetodoPago } from "@/lib/types";
import { actualizarGastoRecurrente, crearGastoRecurrente, eliminarGastoRecurrente } from "@/app/dashboard/actions";
import { fechaCobroEnMesVisto } from "./dates";

export interface RecurringExpensesProps {
  categorias: Categoria[];
  /** Gastos recurrentes iniciales cargados desde Supabase (SSR) */
  initialGastosRecurrentes: GastoRecurrente[];
  /**
   * IDs de suscripciones ya cobradas en el mes que se está viendo. Se agrega
   * en el servidor sobre TODAS las transacciones del mes: derivarlo aquí de
   * la lista recortada a 200 filas hacía que en un mes con mucho movimiento
   * una suscripción ya pagada volviera a aparecer como pendiente — y volver a
   * cobrarla duplicaba el gasto.
   */
  recurrentesCobrados: string[];
  /** Mes que se está viendo (1-12) y su año: el cobro se registra DENTRO de ese mes. */
  anio: number;
  mes: number;
  onRegistrarTransaccion: (datos: {
    categoria_id: string;
    monto: number;
    descripcion: string;
    metodo_pago: MetodoPago;
    gasto_recurrente_id: string;
    fecha: string;
    tipo: "egreso";
  }) => Promise<void>;
  /** Recarga la lista persistida (crear/eliminar suscripción). Sin esto, al terminar el optimistic UI se revierte al snapshot viejo. */
  onListaCambiada?: () => void;
}

let contadorOptimista = 0;

export function useRecurringExpenses({
  categorias,
  initialGastosRecurrentes,
  recurrentesCobrados,
  anio,
  mes,
  onRegistrarTransaccion,
  onListaCambiada,
}: RecurringExpensesProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<GastoRecurrente | null>(null);
  const [nombre, setNombre] = useState("");
  const [montoTexto, setMontoTexto] = useState("");
  const [diaCobro, setDiaCobro] = useState(5);
  const [categoriaId, setCategoriaId] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
  const [isSaving, setIsSaving] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  function resetFormulario() {
    setNombre("");
    setMontoTexto("");
    setDiaCobro(5);
    setCategoriaId("");
    setMetodoPago("tarjeta");
    setEditando(null);
    setErrorForm(null);
  }

  function abrirModalNuevo() {
    resetFormulario();
    setModalAbierto(true);
  }

  function abrirModalEditar(rec: GastoRecurrente) {
    setEditando(rec);
    setNombre(rec.nombre);
    setMontoTexto(String(rec.monto));
    setDiaCobro(rec.dia_cobro);
    setCategoriaId(rec.categoria_id ?? "");
    setMetodoPago(rec.metodo_pago);
    setErrorForm(null);
    setModalAbierto(true);
  }

  function cerrarModalProgramar() {
    setModalAbierto(false);
    resetFormulario();
  }

  useEscapeKey(modalAbierto, cerrarModalProgramar);

  // Derivado de las transacciones reales del mes (no memoria del navegador): sobrevive
  // a cambios de pestaña/refrescos y evita cobrar la misma suscripción dos veces.
  const cobradosEsteMes = useMemo(() => new Set(recurrentesCobrados), [recurrentesCobrados]);

  const hoy = hoyEnMexico();
  const esMesEnCurso = anio === hoy.anio && mes === hoy.mes;
  const nombreMesVisto = capitalizarPrimeraLetra(nombreDelMes(anio, mes));

  // Optimistic UI para eliminaciones y creaciones
  const [recurrentes, setRecurrentesOptimista] = useOptimistic<
    GastoRecurrente[],
    { accion: "crear" | "actualizar" | "eliminar"; item: GastoRecurrente }
  >(initialGastosRecurrentes, (estado, payload) => {
    if (payload.accion === "crear") return [payload.item, ...estado];
    if (payload.accion === "actualizar") return estado.map((r) => (r.id === payload.item.id ? payload.item : r));
    if (payload.accion === "eliminar") return estado.filter((r) => r.id !== payload.item.id);
    return estado;
  });

  const hoyDia = hoy.dia;

  // IDs de gastos recurrentes con un cobro en curso: deshabilita sus botones
  // de "Pagar" mientras se resuelve, para que un doble clic/doble tap (común
  // en móvil con red lenta) no alcance a registrar el mismo cobro dos veces
  // antes de que la UI se entere de que ya se cobró.
  const [procesando, setProcesando] = useState<Set<string>>(new Set());
  const bloqueadosRef = useRef(new Set<string>());
  const [registrados, setRegistrados] = useState(new Set<string>());
  useEffect(() => {
    setRegistrados(prev => {
      const next = new Set(prev);
      for (const id of recurrentesCobrados) next.delete(`${anio}-${mes}-${id}`);
      return next.size === prev.size ? prev : next;
    });
  }, [anio, mes, recurrentesCobrados]);

  async function agregarRecurrente(e: React.FormEvent) {
    e.preventDefault();
    const monto = parsearMonto(montoTexto);
    if (!nombre.trim() || !Number.isFinite(monto) || monto <= 0) {
      setErrorForm("Ingresa un nombre y un monto válido.");
      return;
    }
    if (!categoriaId) {
      setErrorForm("Selecciona una categoría.");
      return;
    }

    setIsSaving(true);
    setErrorForm(null);

    const catId = categoriaId;
    const dia = Math.min(31, Math.max(1, Number(diaCobro)));
    const payload = {
      nombre: nombre.trim(),
      monto,
      dia_cobro: dia,
      categoria_id: catId,
      metodo_pago: metodoPago,
    };

    startTransition(async () => {
      try {
        if (editando) {
          setRecurrentesOptimista({
            accion: "actualizar",
            item: { ...editando, ...payload },
          });
          await actualizarGastoRecurrente(editando.id, payload);
        } else {
          setRecurrentesOptimista({
            accion: "crear",
            item: {
              id: `opt-${++contadorOptimista}`,
              ...payload,
            },
          });
          await crearGastoRecurrente(payload);
        }
        setModalAbierto(false);
        resetFormulario();
        onListaCambiada?.();
      } catch (err) {
        setErrorForm(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function eliminarRecurrente(rec: GastoRecurrente) {
    if (!confirm(`¿Eliminar la suscripción "${rec.nombre}"? Los cobros ya registrados no se borran.`)) {
      return;
    }
    setErrorLista(null);
    startTransition(async () => {
      setRecurrentesOptimista({ accion: "eliminar", item: rec });
      try {
        await eliminarGastoRecurrente(rec.id);
        onListaCambiada?.();
      } catch (err) {
        setErrorLista(err instanceof Error ? err.message : "No se pudo eliminar la suscripción.");
      }
    });
  }

  async function ejecutarCobro(rec: GastoRecurrente, metodoPagoElegido: MetodoPago) {
    const clave = `${anio}-${mes}-${rec.id}`;
    if (bloqueadosRef.current.has(clave) || cobradosEsteMes.has(rec.id) || registrados.has(clave) || !rec.categoria_id) return;
    bloqueadosRef.current.add(clave);
    setProcesando((prev) => new Set(prev).add(rec.id));

    const catId = rec.categoria_id;
    try {
      await onRegistrarTransaccion({
        categoria_id: catId,
        monto: rec.monto,
        descripcion: `Pago recurrente: ${rec.nombre}`,
        metodo_pago: metodoPagoElegido,
        gasto_recurrente_id: rec.id,
        // El cobro se fecha DENTRO del mes que se está viendo. Antes siempre
        // usaba la fecha de hoy: cobrar una suscripción desde un mes pasado
        // metía el gasto en el mes actual y la tarjeta "ya cobrada" nunca se
        // marcaba en el mes donde se había hecho clic.
        fecha: fechaCobroEnMesVisto(anio, mes, rec.dia_cobro, esMesEnCurso, hoyISOEnMexico()),
        tipo: "egreso",
      });
      setRegistrados(prev => new Set(prev).add(clave));
    } catch {
      // El toast de error ya lo muestra el padre (onRegistrarTransaccion);
      // aquí solo nos interesa liberar el botón en el `finally`.
    } finally {
      bloqueadosRef.current.delete(clave);
      setProcesando((prev) => {
        const siguiente = new Set(prev);
        siguiente.delete(rec.id);
        return siguiente;
      });
    }
  }

  const categoriaEgresoDefault = categorias.find((c) => c.tipo === "egreso" && !c.archivada && (!c.naturaleza || c.naturaleza === "egreso"));
  const totalProgramado = recurrentes.reduce((sum, rec) => sum + Number(rec.monto), 0);
  const totalRegistrado = recurrentes.reduce((sum, rec) => sum + (cobradosEsteMes.has(rec.id) || registrados.has(`${anio}-${mes}-${rec.id}`) ? Number(rec.monto) : 0), 0);

  return {
    modalAbierto, editando, nombre, setNombre, montoTexto, setMontoTexto, diaCobro, setDiaCobro,
    categoriaId, setCategoriaId, metodoPago, setMetodoPago, isSaving, errorForm, errorLista,
    abrirModalNuevo, abrirModalEditar, cerrarModalProgramar, agregarRecurrente, eliminarRecurrente,
    ejecutarCobro, cobradosEsteMes, recurrentes, procesando, registrados, nombreMesVisto,
    esMesEnCurso, hoyDia, categoriaEgresoDefault, totalProgramado, totalRegistrado,
  };
}
