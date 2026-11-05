import assert from "node:assert/strict";
import test from "node:test";
import { iniciarSolicitud, claveAccion } from "./advisor/requests";
import type { SupabaseServerClient } from "./advisor/types";

// Simula sólo el almacenamiento y la comparación atómica; no ejecuta herramientas.
function almacen() {
  const filas: Record<string, unknown>[] = [];
  const db = { from() {
    let update: Record<string, unknown> | null = null;
    let insert: Record<string, unknown> | null = null;
    const filtros: [string, unknown][] = [];
    const q = {
      select() { return q; }, eq(k: string, v: unknown) { filtros.push([k, v]); return q; },
      update(v: Record<string, unknown>) { update = v; return q; }, insert(v: Record<string, unknown>) { insert = v; return q; },
      maybeSingle() { return Promise.resolve(ejecutar()); },
      then(resolve: (v: ReturnType<typeof ejecutar>) => unknown) { return Promise.resolve(ejecutar()).then(resolve); },
    };
    function ejecutar() {
      if (insert) {
        if (filas.some(f => f.id === insert!.id)) return { data: null, error: { code: "23505" } };
        filas.push({ estado: "procesando", acciones: [], actualizado_en: new Date().toISOString(), ...insert });
        return { data: null, error: null };
      }
      const fila = filas.find(f => filtros.every(([k, v]) => f[k] === v));
      if (fila && update) Object.assign(fila, update);
      return { data: fila ? { ...fila } : null, error: null };
    }
    return q;
  } } as unknown as SupabaseServerClient;
  return { db, filas };
}

test("un reintento recupera acciones completadas sin volver a autorizar escrituras", async () => {
  const { db, filas } = almacen(); const id = crypto.randomUUID();
  assert.deepEqual(await iniciarSolicitud(db, "u", id, "Anota 50"), { continuar: true, reintento: false });
  assert.equal((await iniciarSolicitud(db, "u", id, "Anota 50")).continuar, false);
  filas[0].estado = "error"; filas[0].acciones = [{ clave: "k", herramienta: "registrar_movimiento", estado: "realizada", resultado: "Registrados $50" }];
  const r = await iniciarSolicitud(db, "u", id, "Anota 50");
  assert.equal(r.continuar, false);
  if (!r.continuar) { assert.ok(r.resultado.ok); if (r.resultado.ok) { assert.equal(r.resultado.datosModificados, true); assert.match(r.resultado.mensajeAsistente.contenido, /Registrados \$50/); } }
  assert.equal(filas.length, 1);
  const colision = await iniciarSolicitud(db, "u", id, "Anota 500");
  assert.equal(colision.continuar, false); if (!colision.continuar) assert.equal(colision.resultado.ok, false);
});

test("una solicitud interrumpida se recupera y una acción incierta no se repite", async () => {
  const { db, filas } = almacen(); const id = crypto.randomUUID();
  await iniciarSolicitud(db, "u", id, "Consulta mi saldo");
  filas[0].actualizado_en = "2020-01-01T00:00:00Z";
  assert.deepEqual(await iniciarSolicitud(db, "u", id, "Consulta mi saldo"), { continuar: true, reintento: true });
  filas[0].actualizado_en = "2020-01-01T00:00:00Z";
  filas[0].acciones = [{ clave: "k", herramienta: "editar_movimiento", estado: "iniciada" }];
  const r = await iniciarSolicitud(db, "u", id, "Consulta mi saldo");
  assert.equal(r.continuar, false); if (!r.continuar && r.resultado.ok) assert.match(r.resultado.mensajeAsistente.contenido, /por confirmar/);
});

test("la misma acción conserva su clave aunque cambie el orden de los argumentos", async () => {
  const id = crypto.randomUUID();
  assert.equal(await claveAccion(id, "registrar_movimiento", '{"monto":50,"categoria":"Café"}'), await claveAccion(id, "registrar_movimiento", '{"categoria":"Café","monto":50}'));
  assert.notEqual(await claveAccion(id, "registrar_movimiento", '{"monto":50}'), await claveAccion(id, "registrar_movimiento", '{"monto":500}'));
});
