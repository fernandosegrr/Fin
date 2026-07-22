"use client";

import { Download } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { TransaccionConCategoria } from "@/lib/types";

interface Props {
  transacciones: TransaccionConCategoria[];
  nombreMes: string;
}

export function ExportButton({ transacciones, nombreMes }: Props) {
  function exportarCSV() {
    if (!transacciones || transacciones.length === 0) {
      alert("No hay transacciones registradas en este mes para exportar.");
      return;
    }

    // Cabecera CSV
    const headers = ["Fecha", "Categoría", "Tipo", "Grupo", "Método de Pago", "Descripción", "Monto"];
    
    // Filas CSV
    const rows = transacciones.map((t) => [
      t.fecha,
      `"${(t.categoria?.nombre || "Sin categoría").replace(/"/g, '""')}"`,
      t.categoria?.tipo || "",
      t.categoria?.grupo || "",
      t.metodo_pago || "tarjeta",
      `"${(t.descripcion || "").replace(/"/g, '""')}"`,
      t.monto,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Finanzas_${nombreMes.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <GlowButton
      variant="secondary"
      onClick={exportarCSV}
      className="!py-1.5 !px-2.5 sm:!px-3.5 !text-xs"
      title="Exportar a CSV / Excel"
    >
      <Download className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Exportar CSV</span>
    </GlowButton>
  );
}
