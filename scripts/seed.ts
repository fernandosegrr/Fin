/**
 * Script de administración — corre FUERA del runtime de Next.js, usando la
 * secret key (bypassa RLS a propósito) para poder insertar categorías para
 * un user_id específico antes de que ese usuario tenga sesión.
 *
 * Uso:
 *   npm run seed -- <user_id>
 *   (o define SEED_USER_ID en .env.local y corre: npm run seed)
 *
 * El user_id es el UUID de auth.users — cópialo desde Supabase Dashboard →
 * Authentication → Users, después de crear tu cuenta desde /login.
 *
 * Nunca importes este archivo desde código de la app (usa la secret key).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const userId = process.argv[2] ?? process.env.SEED_USER_ID;

if (!SUPABASE_URL || SUPABASE_URL.includes("TU-PROYECTO")) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL real en .env.local.");
  process.exit(1);
}
if (!SECRET_KEY) {
  console.error("Falta SUPABASE_SECRET_KEY en .env.local.");
  process.exit(1);
}
if (!userId) {
  console.error(
    "Falta el user_id. Uso: npm run seed -- <user_id>  (o define SEED_USER_ID en .env.local)",
  );
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SemillaCategoria {
  nombre: string;
  tipo: "ingreso" | "egreso";
  grupo: "fijo" | "variable" | null;
}

const CATEGORIAS_SEMILLA: SemillaCategoria[] = [
  { nombre: "Proyectos/Clientes", tipo: "ingreso", grupo: null },
  { nombre: "Suscripciones", tipo: "egreso", grupo: "fijo" },
  { nombre: "Infraestructura de desarrollo", tipo: "egreso", grupo: "fijo" },
  { nombre: "Servicios", tipo: "egreso", grupo: "fijo" },
  { nombre: "Comidas", tipo: "egreso", grupo: "variable" },
  { nombre: "Salidas en pareja", tipo: "egreso", grupo: "variable" },
  { nombre: "Entretenimiento", tipo: "egreso", grupo: "variable" },
];

async function main() {
  console.log(`Sembrando categorías para user_id=${userId}...`);

  const { data: existentes, error: errorLectura } = await supabaseAdmin
    .from("categorias")
    .select("nombre")
    .eq("user_id", userId);

  if (errorLectura) {
    console.error("Error leyendo categorías existentes:", errorLectura.message);
    process.exit(1);
  }

  const nombresExistentes = new Set((existentes ?? []).map((c) => c.nombre));
  const faltantes = CATEGORIAS_SEMILLA.filter((c) => !nombresExistentes.has(c.nombre));

  if (faltantes.length === 0) {
    console.log("Ya existen todas las categorías semilla. Nada que hacer.");
    return;
  }

  const { error: errorInsercion } = await supabaseAdmin
    .from("categorias")
    .insert(faltantes.map((c) => ({ ...c, user_id: userId })));

  if (errorInsercion) {
    console.error("Error insertando categorías:", errorInsercion.message);
    process.exit(1);
  }

  console.log(`Listo: ${faltantes.length} categoría(s) creada(s):`);
  faltantes.forEach((c) =>
    console.log(`  - ${c.nombre} (${c.tipo}${c.grupo ? "/" + c.grupo : ""})`),
  );
}

main();
