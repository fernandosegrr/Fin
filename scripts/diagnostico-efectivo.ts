/**
 * Diagnóstico puntual del saldo en efectivo. Corre con la secret key
 * (bypassa RLS) para un user_id. No imprime secretos.
 *
 *   npx tsx scripts/diagnostico-efectivo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const userId = process.argv[2] ?? process.env.SEED_USER_ID;

if (!url || !secret || !userId) {
  console.error("Faltan URL/secret o user_id. Uso: npx tsx scripts/diagnostico-efectivo.ts <user_id>");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function consulta(tabla: string, select: string) { return supabase.from(tabla).select(select); }
type Consulta = ReturnType<typeof consulta>;

async function todas<T>(tabla: string, select: string, extra?: (q: Consulta) => Consulta): Promise<T[]> {
  const filas: T[] = [];
  const TAM = 1000;
  for (let desde = 0; ; desde += TAM) {
    let q = consulta(tabla, select).eq("user_id", userId).range(desde, desde + TAM - 1);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    const pagina = (data ?? []) as T[];
    filas.push(...pagina);
    if (pagina.length < TAM) break;
  }
  return filas;
}

type Tx = {
  id: string;
  monto: number | string;
  fecha: string;
  metodo_pago: string;
  descripcion: string | null;
  categoria: { nombre: string; tipo: string } | { nombre: string; tipo: string }[] | null;
};
type Tr = {
  id: string;
  monto: number | string;
  fecha: string;
  origen: string;
  destino: string;
  descripcion: string | null;
};

function tipoDe(c: Tx["categoria"]): string | null {
  if (!c) return null;
  if (Array.isArray(c)) return c[0]?.tipo ?? null;
  return c.tipo;
}
function nombreDe(c: Tx["categoria"]): string {
  if (!c) return "(sin categoría)";
  if (Array.isArray(c)) return c[0]?.nombre ?? "(array vacío)";
  return c.nombre;
}

async function main() {
  const [txs, trs] = await Promise.all([
    todas<Tx>("transacciones", "id, monto, fecha, metodo_pago, descripcion, categoria:categorias(nombre, tipo)"),
    todas<Tr>("transferencias", "id, monto, fecha, origen, destino, descripcion"),
  ]);

  const metodos = new Map<string, number>();
  const tiposCat = new Map<string, number>();
  let categoriasArray = 0;
  let categoriasNull = 0;

  for (const t of txs) {
    metodos.set(t.metodo_pago, (metodos.get(t.metodo_pago) ?? 0) + 1);
    if (t.categoria == null) categoriasNull += 1;
    else if (Array.isArray(t.categoria)) categoriasArray += 1;
    const tipo = tipoDe(t.categoria) ?? "null";
    tiposCat.set(tipo, (tiposCat.get(tipo) ?? 0) + 1);
  }

  let efectivo = 0;
  let tarjeta = 0;
  const porMes = new Map<string, { efectivo: number; tarjeta: number; txs: number; trs: number }>();
  const lineasEfectivo: string[] = [];

  function bucket(fecha: string) {
    const mes = fecha.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, { efectivo: 0, tarjeta: 0, txs: 0, trs: 0 });
    return porMes.get(mes)!;
  }

  for (const t of txs) {
    const monto = n(t.monto);
    const tipo = tipoDe(t.categoria);
    const delta = tipo === "ingreso" ? monto : tipo === "egreso" ? -monto : 0;
    const b = bucket(t.fecha);
    b.txs += 1;
    if (t.metodo_pago === "efectivo") {
      efectivo += delta;
      b.efectivo += delta;
      lineasEfectivo.push(
        `${t.fecha}  ${delta >= 0 ? "+" : ""}${delta.toFixed(2).padStart(10)}  ${nombreDe(t.categoria)}  ${t.descripcion ?? ""}`.trimEnd(),
      );
    } else {
      tarjeta += delta;
      b.tarjeta += delta;
    }
  }

  for (const t of trs) {
    const monto = n(t.monto);
    const b = bucket(t.fecha);
    b.trs += 1;
    if (t.origen === "efectivo") {
      efectivo -= monto;
      b.efectivo -= monto;
      lineasEfectivo.push(`${t.fecha}  ${(-monto).toFixed(2).padStart(11)}  TRASPASO ${t.origen}→${t.destino}  ${t.descripcion ?? ""}`.trimEnd());
    } else {
      tarjeta -= monto;
      b.tarjeta -= monto;
    }
    if (t.destino === "efectivo") {
      efectivo += monto;
      b.efectivo += monto;
      lineasEfectivo.push(`${t.fecha}  ${monto.toFixed(2).padStart(11)}  TRASPASO ${t.origen}→${t.destino}  ${t.descripcion ?? ""}`.trimEnd());
    } else {
      tarjeta += monto;
      b.tarjeta += monto;
    }
  }

  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const mesActual = hoy.slice(0, 7);

  let histEfectivo = 0;
  let histTarjeta = 0;
  let mesEfectivo = 0;
  let mesTarjeta = 0;
  for (const [mes, v] of porMes) {
    if (mes < mesActual) {
      histEfectivo += v.efectivo;
      histTarjeta += v.tarjeta;
    } else if (mes === mesActual) {
      mesEfectivo += v.efectivo;
      mesTarjeta += v.tarjeta;
    }
  }

  console.log("=== CONTEOS ===");
  console.log("transacciones", txs.length, "transferencias", trs.length);
  console.log("metodo_pago", Object.fromEntries(metodos));
  console.log("tipo categoria", Object.fromEntries(tiposCat));
  console.log("categoria null", categoriasNull, "categoria array", categoriasArray);
  console.log("hoy Mexico", hoy, "mes visto (app al abrir)", mesActual);

  console.log("\n=== SALDO TOTAL (todo el historial) ===");
  console.log("efectivo", efectivo.toFixed(2));
  console.log("tarjeta ", tarjeta.toFixed(2));
  console.log("total   ", (efectivo + tarjeta).toFixed(2));

  console.log("\n=== COMO LO CALCULA LA APP (histórico < mes + neto del mes) ===");
  console.log("histórico efectivo (< " + mesActual + "-01)", histEfectivo.toFixed(2));
  console.log("neto mes efectivo", mesEfectivo.toFixed(2));
  console.log("SALDO EFECTIVO EN PANTALLA", (histEfectivo + mesEfectivo).toFixed(2));
  console.log("histórico tarjeta", histTarjeta.toFixed(2));
  console.log("neto mes tarjeta", mesTarjeta.toFixed(2));
  console.log("SALDO TARJETA EN PANTALLA", (histTarjeta + mesTarjeta).toFixed(2));

  console.log("\n=== POR MES (delta efectivo / tarjeta) ===");
  for (const mes of [...porMes.keys()].sort()) {
    const v = porMes.get(mes)!;
    console.log(
      mes,
      "efectivo",
      v.efectivo.toFixed(2).padStart(10),
      "tarjeta",
      v.tarjeta.toFixed(2).padStart(10),
      "txs",
      v.txs,
      "traspasos",
      v.trs,
    );
  }

  console.log("\n=== MOVIMIENTOS QUE TOCAN EFECTIVO ===");
  lineasEfectivo.sort();
  for (const l of lineasEfectivo) console.log(l);

  const ingresosTarjeta = txs.filter((t) => t.metodo_pago !== "efectivo" && tipoDe(t.categoria) === "ingreso");
  if (ingresosTarjeta.length) {
    console.log("\n=== INGRESOS EN TARJETA (por si un depósito en efectivo quedó mal clasificado) ===");
    for (const t of ingresosTarjeta) {
      console.log(t.fecha, n(t.monto).toFixed(2), nombreDe(t.categoria), t.descripcion ?? "");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
