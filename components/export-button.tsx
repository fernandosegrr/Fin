"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { obtenerTransaccionesCompletasDelMes, obtenerTransferenciasCompletasDelMes } from "@/app/dashboard/actions";

interface Props {
  anio: number;
  mes: number;
  nombreMes: string;
}

export function ExportButton({ anio, mes, nombreMes }: Props) {
  const [exportando, setExportando] = useState(false);

  async function exportarExcel() {
    setExportando(true);
    try {
      // Se piden las transacciones del mes completo (sin el límite de 200
      // filas que usa la vista principal por rendimiento) para que el archivo
      // nunca quede incompleto en meses con muchos movimientos.
      const [transacciones, transferencias, XLSX] = await Promise.all([
        obtenerTransaccionesCompletasDelMes(anio, mes),
        obtenerTransferenciasCompletasDelMes(anio, mes),
        import("xlsx"),
      ]);

      if (transacciones.length === 0 && transferencias.length === 0) {
        alert("No hay movimientos ni traspasos en este mes para exportar.");
        return;
      }

      const encabezados = ["Fecha", "Categoría", "Tipo", "Grupo", "Cliente", "Método de Pago", "Descripción", "Monto"];
      const filas = transacciones.map((t) => [
        t.fecha,
        t.categoria?.nombre || "Sin categoría",
        t.categoria?.tipo || "",
        t.categoria?.grupo || "",
        t.cliente?.nombre || "",
        t.metodo_pago || "tarjeta",
        t.descripcion || "",
        t.monto,
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
            t.origen,
            t.destino,
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
    >
      {exportando ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0" />
      )}
      <span className="hidden sm:inline">Exportar Excel</span>
    </GlowButton>
  );
}
