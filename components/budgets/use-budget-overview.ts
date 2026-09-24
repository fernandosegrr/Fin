"use client";

import { useEffect, useRef, useState } from "react";
import { copiarPresupuestosMesAnterior } from "@/app/dashboard/actions";
import type { PresupuestoConGasto } from "@/lib/types";
import { redondearMonto } from "@/lib/format";

interface Options {
  items: PresupuestoConGasto[];
  mesISO: string;
  onPresupuestosGuardados?: () => void;
}

export function useBudgetOverview({ items, mesISO, onPresupuestosGuardados }: Options) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [mensajeCopia, setMensajeCopia] = useState<string | null>(null);
  const [errorCopia, setErrorCopia] = useState<string | null>(null);
  const mesActualRef = useRef(mesISO);
  mesActualRef.current = mesISO;

  useEffect(() => {
    setMensajeCopia(null);
    setErrorCopia(null);
  }, [mesISO]);

  const hayAlgunLimite = items.some((i) => i.presupuesto);
  const conLimite = items.filter(item => item.presupuesto);
  const limiteTotal = redondearMonto(conLimite.reduce((total, item) => total + Number(item.presupuesto!.monto_limite), 0));
  const gastoTotal = redondearMonto(conLimite.reduce((total, item) => total + item.gastado, 0));

  async function copiarDelMesAnterior() {
    if (copiando) return;
    setCopiando(true);
    setErrorCopia(null);
    setMensajeCopia(null);
    try {
      const resultado = await copiarPresupuestosMesAnterior(mesISO);
      if (mesActualRef.current !== mesISO) return;
      if (resultado.ok) {
        setMensajeCopia(
          resultado.copiados === 1
            ? "Se copió 1 presupuesto del mes anterior."
            : `Se copiaron ${resultado.copiados} presupuestos del mes anterior.`,
        );
        onPresupuestosGuardados?.();
      } else {
        setErrorCopia(resultado.error);
      }
    } catch (err) {
      if (mesActualRef.current === mesISO) {
        setErrorCopia(err instanceof Error ? err.message : "No se pudieron copiar los presupuestos.");
      }
    } finally {
      setCopiando(false);
    }
  }

  return {
    modalAbierto, setModalAbierto, copiando, mensajeCopia, errorCopia,
    hayAlgunLimite, conLimite, limiteTotal, gastoTotal, copiarDelMesAnterior,
  };
}
