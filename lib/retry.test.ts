import assert from "node:assert/strict";
import test from "node:test";
import { esErrorTransitorio, reintentarLectura } from "./supabase/retry";

test("reintenta una lectura transitoria y devuelve los datos recuperados", async () => {
  let intentos = 0;
  const resultado = await reintentarLectura(async () => {
    intentos++;
    if (intentos < 3) throw { code: "PGRST002", message: "Database starting" };
    return [1, 2, 3];
  }, [0, 0]);

  assert.deepEqual(resultado, [1, 2, 3]);
  assert.equal(intentos, 3);
});

test("no repite errores de permisos ni de esquema", async () => {
  let intentos = 0;
  const error = { code: "42501", message: "permission denied" };
  await assert.rejects(
    reintentarLectura(async () => {
      intentos++;
      throw error;
    }, [0, 0]),
    error,
  );
  assert.equal(intentos, 1);
  assert.equal(esErrorTransitorio({ status: 503 }), true);
  assert.equal(esErrorTransitorio({ status: 401 }), false);
});

test("agota los reintentos y conserva el error original", async () => {
  let intentos = 0;
  const error = new Error("fetch failed");
  await assert.rejects(
    reintentarLectura(async () => {
      intentos++;
      throw error;
    }, [0, 0]),
    (recibido) => recibido === error,
  );
  assert.equal(intentos, 3);
});
