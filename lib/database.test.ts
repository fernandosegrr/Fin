import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

test("las migraciones protegen propietarios, aplican lotes atómicos y permiten deshacer sin pisar cambios posteriores", async () => {
  const db = new PGlite();
  const user = "11111111-1111-4111-8111-111111111111";
  const otro = "22222222-2222-4222-8222-222222222222";
  const cat = "33333333-3333-4333-8333-333333333333";
  const catAjena = "44444444-4444-4444-8444-444444444444";
  const tx = "55555555-5555-4555-8555-555555555555";
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      grant usage on schema auth,public to authenticated;
      grant execute on function auth.uid() to authenticated;
      alter default privileges in schema public grant all on tables to authenticated;
      alter default privileges in schema public grant usage,select on sequences to authenticated;
      insert into auth.users(id) values('${user}'),('${otro}');`);
    const root = path.join(process.cwd(), "prisma", "migrations");
    for (const nombre of readdirSync(root).filter(n => /^\d/.test(n)).sort()) {
      const archivo = nombre === "20261105010000_cuentas_y_clasificacion" ? path.join(process.cwd(), "docs/SUPABASE_AUDITORIA.sql") : path.join(root, nombre, "migration.sql");
      if (nombre === "20261105010000_cuentas_y_clasificacion") assert.ok(readFileSync(archivo, "utf8").includes(readFileSync(path.join(root, nombre, "migration.sql"), "utf8")), "El SQL listo para pegar debe contener la migración exacta.");
      const sql = readFileSync(archivo, "utf8").replace(/create extension if not exists pgcrypto\s*;/gi, "");
      await db.exec(sql);
      if (nombre === "20261105010000_cuentas_y_clasificacion") await db.exec(sql); // El SQL entregado se puede pegar de nuevo sin duplicar.
      if (nombre === "20260810120000_baseline") {
        await db.exec(`insert into categorias(id,user_id,nombre,tipo,grupo) values('${cat}','${user}','Comida','egreso','variable'),('${catAjena}','${otro}','Privada','egreso','variable');
          insert into transacciones(id,user_id,categoria_id,monto,fecha) values('${tx}','${user}','${cat}',10,'2026-11-05');`);
      }
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated;");
    const cuentas = (await db.query<{ id: string; codigo: string }>("select id,codigo from cuentas_financieras order by codigo")).rows;
    assert.equal(cuentas.length, 3);
    const principal = cuentas.find(c => c.codigo === "principal")!.id;
    const ahorro = cuentas.find(c => c.codigo === "ahorro")!.id;
    await assert.rejects(db.query("insert into transacciones(user_id,categoria_id,cuenta_id,naturaleza,monto) values($1,$2,$3,'egreso',5)", [user, catAjena, principal]), /categoría no pertenece/);
    await assert.rejects(db.query("insert into cambios_financieros(user_id,lote_id,entidad,registro_id) values($1,gen_random_uuid(),'transacciones',$2)", [user, tx]), /permission denied/);
    const antes = (await db.query<{ snapshot: Record<string, unknown> }>("select to_jsonb(t) snapshot from transacciones t where id=$1", [tx])).rows[0].snapshot;
    const lote = crypto.randomUUID();
    const plan = { transacciones: [{ antes, despues: { id: tx, user_id: user, naturaleza: "traspaso", cuenta_id: principal, cuenta_destino_id: ahorro, etiquetas: ["Ahorro"] } }] };
    const ejecutar = (p: object, id: string) => db.query<{ resultado: { repetido: boolean } }>("select aplicar_plan_financiero($1::jsonb,$2::uuid,'Prueba') resultado", [JSON.stringify(p), id]);
    assert.equal((await ejecutar(plan, lote)).rows[0].resultado.repetido, false);
    assert.equal((await ejecutar(plan, lote)).rows[0].resultado.repetido, true);
    assert.equal((await db.query<{ naturaleza: string }>("select naturaleza from transacciones where id=$1", [tx])).rows[0].naturaleza, "traspaso");
    await db.query("select revertir_lote_financiero($1)", [lote]);
    assert.equal((await db.query<{ naturaleza: string }>("select naturaleza from transacciones where id=$1", [tx])).rows[0].naturaleza, "egreso");
    const fresco = (await db.query<{ snapshot: Record<string, unknown> }>("select to_jsonb(t) snapshot from transacciones t where id=$1", [tx])).rows[0].snapshot;
    const lote2 = crypto.randomUUID();
    await ejecutar({ transacciones: [{ antes: fresco, despues: { id: tx, user_id: user, descripcion: "Café" } }] }, lote2);
    await db.query("update transacciones set descripcion='Edición posterior' where id=$1", [tx]);
    await assert.rejects(db.query("select revertir_lote_financiero($1)", [lote2]), /cambios posteriores/);
    assert.equal((await db.query<{ descripcion: string }>("select descripcion from transacciones where id=$1", [tx])).rows[0].descripcion, "Edición posterior");
    const lote3 = crypto.randomUUID();
    await assert.rejects(ejecutar({ transacciones: [
      { antes: null, despues: { id: crypto.randomUUID(), user_id: user, categoria_id: cat, cuenta_id: principal, naturaleza: "egreso", monto: 5, fecha: "2026-11-05" } },
      { antes: null, despues: { id: crypto.randomUUID(), user_id: otro, categoria_id: catAjena, cuenta_id: principal, naturaleza: "egreso", monto: 5, fecha: "2026-11-05" } },
    ] }, lote3), /Cuenta ajena/);
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from transacciones")).rows[0].n, 1);
    assert.equal((await db.query<{ n: number }>("select count(*)::int n from lotes_financieros where id=$1", [lote3])).rows[0].n, 0);
    const cat2 = crypto.randomUUID();
    await db.query("insert into categorias(id,user_id,nombre,tipo,grupo,naturaleza) values($1,$2,'Restaurantes','egreso','variable','egreso')", [cat2, user]);
    await db.query("select guardar_presupuestos_financieros('2026-11-01',$1)", [JSON.stringify([{ categoria_id: cat, monto_limite: 100 }, { categoria_id: cat2, monto_limite: 50 }])]);
    await db.query("select fusionar_categorias_financieras($1,$2)", [cat, cat2]);
    assert.equal(Number((await db.query<{ monto: string }>("select monto_limite monto from presupuestos where categoria_id=$1", [cat2])).rows[0].monto), 150);
    assert.equal((await db.query<{ categoria_id: string }>("select categoria_id from transacciones where id=$1", [tx])).rows[0].categoria_id, cat2);
    const fusion = (await db.query<{ id: string }>("select id from lotes_financieros where nombre='Fusionar categorías'")).rows[0].id;
    await db.query("select revertir_lote_financiero($1)", [fusion]);
    assert.equal((await db.query<{ categoria_id: string }>("select categoria_id from transacciones where id=$1", [tx])).rows[0].categoria_id, cat);
    assert.deepEqual((await db.query<{ monto: string }>("select monto_limite monto from presupuestos order by monto_limite")).rows.map(r => Number(r.monto)), [50, 100]);
    await db.query("select copiar_presupuestos_vigentes('2026-12-01')");
    assert.equal((await db.query("select id from presupuestos where mes='2026-12-01'")).rows.length, 2);
    await db.query("select guardar_presupuestos_financieros('2026-12-01',$1)", [JSON.stringify([{ categoria_id: cat, monto_limite: 0 }, { categoria_id: cat2, monto_limite: 0 }])]);
    await db.query("select copiar_presupuestos_vigentes('2026-12-01')");
    assert.equal((await db.query("select id from presupuestos where mes='2026-12-01'")).rows.length, 0);
    const buscar = (args: unknown[]) => db.query<{ r: { total: number; filas: { clase: string }[] } }>("select buscar_historial_financiero($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r", args);
    const filtros = ["Edición", "todos", "todos", principal, cat, "egreso", "2026-11-05", "2026-11-05", false, 0, 50];
    assert.equal((await buscar(filtros)).rows[0].r.total, 1);
    assert.equal((await buscar([...filtros.slice(0, 7), "2026-11-04", false, 0, 50])).rows[0].r.total, 0);
  } finally { await db.close(); }
});
