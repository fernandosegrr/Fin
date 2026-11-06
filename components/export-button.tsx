"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { obtenerTransaccionesCompletasDelMes, obtenerTransferenciasCompletasDelMes } from "@/app/dashboard/actions";
import type { CuentaFinanciera } from "@/lib/finance/types";
import { NOMBRES_NATURALEZA } from "@/lib/finance/types";
import { naturalezaDe } from "@/lib/finance/ledger";

interface Props {
  anio: number;
  mes: number;
  nombreMes: string;
  cuentas?: CuentaFinanciera[];
}

export function ExportButton({ anio, mes, nombreMes, cuentas = [] }: Props) {
  const [exportando, setExportando] = useState(false);

  async function exportarExcel() {
    setExportando(true);
    try {
      // Exportación completa, independiente de la página visible.
      const [transacciones, transferencias, XLSX] = await Promise.all([
        obtenerTransaccionesCompletasDelMes(anio, mes),
        obtenerTransferenciasCompletasDelMes(anio, mes),
        import("xlsx"),
      ]);

      if (transacciones.length === 0 && transferencias.length === 0) {
        alert("No hay movimientos ni traspasos en este mes para exportar.");
        return;
      }

      const nombres = new Map(cuentas.map(c => [c.id, c.nombre]));
      const encabezados = ["ID", "Fecha", "Categoría", "Naturaleza", "Grupo", "Cliente", "Cuenta", "Destino", "Método de pago", "Descripción", "Monto MXN", "Interés bruto", "Retención", "Etiquetas", "Pendiente de revisión", "Motivo"];
      const filas = transacciones.map((t) => [
        t.id,
        t.fecha,
        t.categoria?.nombre || "Sin categoría",
        NOMBRES_NATURALEZA[naturalezaDe(t)],
        t.categoria?.grupo || "",
        t.cliente?.nombre || "",
        nombres.get(t.cuenta_id || "") || t.metodo_pago || "",
        nombres.get(t.cuenta_destino_id || "") || "",
        t.metodo_pago || "tarjeta",
        t.descripcion || "",
        t.monto,
        t.interes_bruto ?? "", t.impuesto_retenido ?? "", t.etiquetas?.join(", ") || "", t.requiere_revision ? "Sí" : "No", t.motivo_revision || "",
      ]);

      // aoa_to_sheet guarda cada valor de texto como celda tipo string (t: 's')
      // tal cual, sin interpretarlo como fórmula — a diferencia de un CSV
      // (que depende de que Excel/Sheets "adivinen" el tipo al importar), un
      // xlsx real ya viene tipado, así que un descripción/categoría que
      // empiece con "=" no puede convertirse en fórmula al abrirlo.
      const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Movimientos");

      if (transferencias.length > 0) {
        const hojaTraspasos = XLSX.utils.aoa_to_sheet([
          ["Fecha", "Origen", "Destino", "Descripción", "Monto"],
          ...transferencias.map((t) => [
            t.fecha,
            nombres.get(t.cuenta_origen_id || "") || t.origen,
            nombres.get(t.cuenta_destino_id || "") || t.destino,
            t.descripcion || "",
            t.monto,
          ]),
        ]);
        XLSX.utils.book_append_sheet(libro, hojaTraspasos, "Traspasos");
      }
      const buffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });

      // Blob + URL.createObjectURL en vez de un data: URI: Safari en iOS no
      // dispara la descarga de un <a download> con un data: URI (navega o
      // muestra el contenido crudo en vez de guardar el archivo) — con un
      // blob: URL sí funciona, incluido en iPhone.
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Finanzas_${nombreMes.replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revocar un momento después, no en el mismo tick: hacerlo de inmediato
      // puede invalidar la URL antes de que el navegador alcance a iniciar la
      // descarga (más notorio en Safari/iOS).
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar el archivo.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <GlowButton
      variant="secondary"
      onClick={exportarExcel}
      disabled={exportando}
      className="!py-1.5 !px-2.5 sm:!px-3.5 !text-xs"
      title="Exportar a Excel"
      aria-label="Exportar Excel"
    >
      {exportando ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0" />
      )}
      <span>Exportar Excel</span>
    </GlowButton>
  );
}
