/** Uso: npx tsx scripts/financial-plan.ts --original <json> --config <json> --output <carpeta privada> [--rehearse | --apply]
 * Sin --apply no se modifica producción. El ensayo usa PostgreSQL local en memoria.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { config as dotenv } from "dotenv";
import { prepararReclasificacion, type ConfiguracionReclasificacion, type InstantaneaFinanciera } from "../lib/finance/reclassification";
import { resumirLibro } from "../lib/finance/ledger";
import type { Categoria, Transaccion } from "../lib/types";

const tablas = ["categorias", "transacciones", "transferencias", "gastos_recurrentes", "presupuestos", "metas_ahorro", "clientes", "cuentas_financieras"] as const;
function argumento(nombre: string) { const i = process.argv.indexOf(nombre); if (i < 0 || !process.argv[i + 1]) throw new Error(`Falta ${nombre}`); return path.resolve(process.argv[i + 1]); }
const original = JSON.parse(readFileSync(argumento("--original"), "utf8")) as InstantaneaFinanciera;
const configuracion = JSON.parse(readFileSync(argumento("--config"), "utf8")) as ConfiguracionReclasificacion;
const salida = argumento("--output");
if (salida.toLowerCase().startsWith(process.cwd().toLowerCase() + path.sep)) throw new Error("Guarda los datos privados fuera del repositorio.");
mkdirSync(salida, { recursive: true });
const userId = original.transacciones[0].user_id;
function escribir(nombre: string, dato: unknown) { writeFileSync(path.join(salida, nombre), JSON.stringify(dato, null, 2)); }

async function ensayo() {
  const db = new PGlite();
  const otro = crypto.randomUUID();
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      grant usage on schema auth,public to authenticated;
      grant execute on function auth.uid() to authenticated;
      alter default privileges in schema public grant all on tables to authenticated;
      alter default privileges in schema public grant usage,select on sequences to authenticated;`);
    await db.query("insert into auth.users(id,email) values($1,$2),($3,'otra-cuenta@example.test')", [userId, configuracion.email, otro]);
    const root = path.join(process.cwd(), "prisma/migrations");
    for (const nombre of readdirSync(root).filter(n => /^\d/.test(n)).sort()) {
      if (nombre === "20261105010000_cuentas_y_clasificacion") {
        for (const tabla of ["categorias", "clientes", "gastos_recurrentes", "transacciones", "transferencias", "presupuestos", "metas_ahorro"] as const) {
          for (const registro of original[tabla]) {
            const campos = Object.keys(registro).filter(k => /^[a-z_]+$/.test(k));
            await db.query(`insert into public.${tabla}(${campos.join(",")}) select ${campos.join(",")} from jsonb_populate_record(null::public.${tabla},$1)`, [JSON.stringify(registro)]);
          }
        }
      }
      await db.exec(readFileSync(path.join(root, nombre, "migration.sql"), "utf8").replace(/create extension if not exists pgcrypto\s*;/gi, ""));
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    await db.exec("set role authenticated");
    async function snapshot(): Promise<InstantaneaFinanciera> {
      const valores: Record<string, unknown> = {};
      for (const t of tablas) valores[t] = (await db.query<{ dato: object }>(`select to_jsonb(t) dato from public.${t} t`)).rows.map(r => r.dato);
      return valores as unknown as InstantaneaFinanciera;
    }
    const actual = await snapshot();
    const resultado = prepararReclasificacion(original, actual, configuracion);
    escribir("plan-ensayado.json", resultado.plan);
    const ejecutar = () => db.query<{ resultado: { repetido: boolean } }>("select aplicar_plan_financiero($1,$2,'Reclasificación histórica') resultado", [JSON.stringify(resultado.plan), configuracion.loteId]);
    assert.equal((await ejecutar()).rows[0].resultado.repetido, false);
    assert.equal((await ejecutar()).rows[0].resultado.repetido, true);
    const despues = await snapshot();
    assert.equal(despues.transacciones.length, resultado.cobertura.despues);
    for (const t of original.transacciones) assert.ok(despues.transacciones.some(a => a.id === t.id));
    assert.equal(despues.transferencias.length, resultado.cobertura.traspasos);
    const categorias = new Map(despues.categorias.map(c => [c.id, c]));
    const libro = resumirLibro(despues.cuentas_financieras!, despues.transacciones.map(t => ({ ...t, categoria: categorias.get(t.categoria_id)! })), despues.transferencias, "2000-01-01", "2100-01-01");
    assert.equal(libro.activos, resultado.despues.activos);
    assert.equal(libro.disponible, resultado.antes.disponible);
    const saldosRpc = (await db.query<{ efectivo: string; tarjeta: string }>("select * from calcular_saldo_historico('2100-01-01')")).rows[0];
    assert.equal(Math.round((Number(saldosRpc.efectivo) + Number(saldosRpc.tarjeta)) * 100), Math.round(libro.disponible * 100));
    const busqueda = await db.query<{ resultado: { total: number } }>("select buscar_historial_financiero('', 'todos', 'todos', null, null, null, null, null, false, 0, 50) resultado");
    assert.equal(Number(busqueda.rows[0].resultado.total), despues.transacciones.length + despues.transferencias.length);
    await db.query("select copiar_presupuestos_vigentes($1)", ["2026-12-01"]);
    assert.ok((await db.query("select id from presupuestos where mes='2026-12-01'")).rows.length > 0);
    // La copia de presupuesto es un cambio posterior; quitarla antes del ensayo de deshacer.
    await db.query("delete from presupuestos where mes='2026-12-01'");
    await db.query("select revertir_lote_financiero($1)", [configuracion.loteId]);
    const restaurada = await snapshot();
    assert.equal(restaurada.transacciones.length, original.transacciones.length);
    assert.equal(restaurada.transferencias.length, original.transferencias.length);
    for (const t of actual.transacciones) {
      const restaurado = restaurada.transacciones.find(a => a.id === t.id)!;
      for (const k of Object.keys(t).filter(k => k !== "actualizado_en")) assert.deepEqual((restaurado as unknown as Record<string, unknown>)[k], (t as unknown as Record<string, unknown>)[k]);
    }
    await db.exec("reset role");
    assert.equal((await db.query("select id from transacciones where user_id=$1", [otro])).rows.length, 0);
    escribir("resultado-ensayo.json", { cobertura: resultado.cobertura, antes: resultado.antes, despues: libro, validaciones: ["RLS", "conservación de saldos", "todos los identificadores", "atomicidad", "reintento idempotente", "búsqueda completa", "presupuesto siguiente mes", "restauración completa"] });
    console.log(JSON.stringify({ ensayo: "correcto", cobertura: resultado.cobertura, ingresos: libro.historicoIngresos, disponible: libro.disponible, ahorro: libro.ahorro, activos: libro.activos }));
  } finally { await db.close(); }
}

async function snapshotProduccion(db: SupabaseClient): Promise<InstantaneaFinanciera> {
  const valores: Record<string, unknown> = {};
  for (const t of tablas) {
    const filas: unknown[] = [];
    for (let offset = 0;; offset += 1000) {
      const r = await db.from(t).select("*").eq("user_id", userId).order("id").range(offset, offset + 999);
      if (r.error) throw new Error(`${t}: ${r.error.message}`);
      filas.push(...r.data); if (r.data.length < 1000) break;
    }
    valores[t] = filas;
  }
  return valores as unknown as InstantaneaFinanciera;
}
async function produccion() {
  dotenv({ path: ".env.local", quiet: true } as Parameters<typeof dotenv>[0]);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !secret || !key) throw new Error("Faltan las credenciales del entorno.");
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const actual = await snapshotProduccion(admin);
  const repetido = await admin.from("lotes_financieros").select("id,revertido").eq("id", configuracion.loteId).eq("user_id", userId).maybeSingle();
  if (repetido.error) throw new Error(repetido.error.message);
  if (repetido.data) { console.log(JSON.stringify({ aplicadoPreviamente: !repetido.data.revertido, lote: configuracion.loteId })); return; }
  const resultado = prepararReclasificacion(original, actual, configuracion);
  escribir("respaldo-antes-de-aplicar.json", actual); escribir("plan-produccion.json", resultado.plan);
  escribir("resumen-produccion.json", { antes: resultado.antes, despues: resultado.despues, cobertura: resultado.cobertura });
  if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ aplicado: false, cobertura: resultado.cobertura })); return; }
  // generateLink NO envía correo. La sesión temporal se mantiene sólo en memoria.
  const enlace = await admin.auth.admin.generateLink({ type: "magiclink", email: configuracion.email });
  if (enlace.error) throw new Error(enlace.error.message);
  if (enlace.data.user.id !== userId) throw new Error("El correo no corresponde al propietario del respaldo.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const sesion = await db.auth.verifyOtp({ token_hash: enlace.data.properties.hashed_token, type: "magiclink" });
    if (sesion.error || sesion.data.user?.id !== userId) throw new Error(sesion.error?.message || "Identidad incorrecta.");
    const r = await db.rpc("aplicar_plan_financiero", { p_plan: resultado.plan, p_lote: configuracion.loteId, p_nombre: "Auditoría y reclasificación histórica" });
    if (r.error) throw new Error(r.error.message);
    const final = await snapshotProduccion(db);
    assert.equal(final.transacciones.length, resultado.cobertura.despues);
    const categorias = new Map<string, Categoria>(final.categorias.map(c => [c.id, c]));
    const libro = resumirLibro(final.cuentas_financieras!, final.transacciones.map((t: Transaccion) => ({ ...t, categoria: categorias.get(t.categoria_id)! })), final.transferencias, "2000-01-01", "2100-01-01");
    assert.equal(libro.activos, resultado.despues.activos); assert.equal(libro.disponible, resultado.antes.disponible);
    escribir("respaldo-despues-de-aplicar.json", final); escribir("resultado-aplicacion.json", { lote: configuracion.loteId, resultado: r.data, libro });
    console.log(JSON.stringify({ aplicado: true, cobertura: resultado.cobertura, disponible: libro.disponible, ahorro: libro.ahorro, activos: libro.activos, ingresos: libro.historicoIngresos }));
  } finally { await db.auth.signOut({ scope: "local" }); }
}
(process.argv.includes("--rehearse") ? ensayo() : produccion()).catch(e => { console.error(e instanceof Error ? e.message : "Falló la operación."); process.exitCode = 1; });
