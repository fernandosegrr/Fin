"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { obtenerTransaccionesCompletasDelMes } from "@/app/dashboard/actions";

interface Props {
  anio: number;
  mes: number;
  nombreMes: string;
}

/**
 * Previene inyección de fórmulas al abrir el CSV en Excel/Sheets: si un
 * campo de texto libre (descripción, nombre de categoría) empieza con
 * =, +, -, @, tab o retorno de carro, esos programas pueden interpretarlo
 * como el inicio de una fórmula en vez de texto plano.
 */
function celdaTextoSegura(valor: string): string {
  const sanitizado = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${sanitizado.replace(/"/g, '""')}"`;
}

export function ExportButton({ anio, mes, nombreMes }: Props) {
  const [exportando, setExportando] = useState(false);

  async function exportarCSV() {
    setExportando(true);
    try {
      // Se piden las transacciones del mes completo (sin el límite de 200
      // filas que usa la vista principal por rendimiento) para que el CSV
      // nunca quede incompleto en meses con muchos movimientos.
      const transacciones = await obtenerTransaccionesCompletasDelMes(anio, mes);

      if (transacciones.length === 0) {
        alert("No hay transacciones registradas en este mes para exportar.");
        return;
      }

      const headers = ["Fecha", "Categoría", "Tipo", "Grupo", "Método de Pago", "Descripción", "Monto"];

      const rows = transacciones.map((t) => [
        t.fecha,
        celdaTextoSegura(t.categoria?.nombre || "Sin categoría"),
        t.categoria?.tipo || "",
        t.categoria?.grupo || "",
        t.metodo_pago || "tarjeta",
        celdaTextoSegura(t.descripcion || ""),
        t.monto,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8,﻿" +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Finanzas_${nombreMes.replace(/\s+/g, "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar el CSV.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <GlowButton
      variant="secondary"
      onClick={exportarCSV}
      disabled={exportando}
      className="!py-1.5 !px-2.5 sm:!px-3.5 !text-xs"
      title="Exportar a CSV / Excel"
    >
      {exportando ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0" />
      )}
      <span className="hidden sm:inline">Exportar CSV</span>
    </GlowButton>
  );
}
