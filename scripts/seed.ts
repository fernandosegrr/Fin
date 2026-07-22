/**
 * Script de administración — corre FUERA del runtime de Next.js, usando la
 * secret key (bypassa RLS a propósito) para poder insertar datos de semilla
 * para un user_id específico antes de que ese usuario tenga sesión.
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
  // Ingresos
  { nombre: "Proyectos / Clientes", tipo: "ingreso", grupo: null },
  { nombre: "Salario", tipo: "ingreso", grupo: null },
  { nombre: "Freelance", tipo: "ingreso", grupo: null },
  // Egresos fijos
  { nombre: "Renta / Hipoteca", tipo: "egreso", grupo: "fijo" },
  { nombre: "Servicios básicos", tipo: "egreso", grupo: "fijo" },
  { nombre: "Suscripciones digitales", tipo: "egreso", grupo: "fijo" },
  { nombre: "Infraestructura / Dev", tipo: "egreso", grupo: "fijo" },
  // Egresos variables
  { nombre: "Comidas y restaurantes", tipo: "egreso", grupo: "variable" },
  { nombre: "Despensa / Supermercado", tipo: "egreso", grupo: "variable" },
  { nombre: "Transporte", tipo: "egreso", grupo: "variable" },
  { nombre: "Entretenimiento", tipo: "egreso", grupo: "variable" },
  { nombre: "Salidas en pareja", tipo: "egreso", grupo: "variable" },
  { nombre: "Salud y farmacia", tipo: "egreso", grupo: "variable" },
  { nombre: "Ropa y accesorios", tipo: "egreso", grupo: "variable" },
];

interface SemillaGastoRecurrente {
  nombre: string;
  monto: number;
  dia_cobro: number;
  metodo_pago: "tarjeta" | "efectivo";
}

const GASTOS_RECURRENTES_SEMILLA: SemillaGastoRecurrente[] = [
  { nombre: "Netflix", monto: 219, dia_cobro: 5, metodo_pago: "tarjeta" },
  { nombre: "Spotify", monto: 115, dia_cobro: 10, metodo_pago: "tarjeta" },
  { nombre: "Plan celular", monto: 450, dia_cobro: 15, metodo_pago: "tarjeta" },
];

async function seedCategorias(): Promise<Map<string, string>> {
  console.log("\n📂 Sembrando categorías...");

  const { data: existentes, error: errorLectura } = await supabaseAdmin
    .from("categorias")
    .select("id, nombre")
    .eq("user_id", userId);

  if (errorLectura) {
    console.error("Error leyendo categorías existentes:", errorLectura.message);
    process.exit(1);
  }

  const mapaExistentes = new Map((existentes ?? []).map((c) => [c.nombre, c.id]));
  const faltantes = CATEGORIAS_SEMILLA.filter((c) => !mapaExistentes.has(c.nombre));

  if (faltantes.length === 0) {
    console.log("  ✓ Todas las categorías semilla ya existen.");
  } else {
    const { data: insertadas, error: errorInsercion } = await supabaseAdmin
      .from("categorias")
      .insert(faltantes.map((c) => ({ ...c, user_id: userId })))
      .select("id, nombre");

    if (errorInsercion) {
      console.error("Error insertando categorías:", errorInsercion.message);
      process.exit(1);
    }

    (insertadas ?? []).forEach((c) => mapaExistentes.set(c.nombre, c.id));
    console.log(`  ✓ ${faltantes.length} categoría(s) creada(s).`);
    faltantes.forEach((c) =>
      console.log(`    - ${c.nombre} (${c.tipo}${c.grupo ? "/" + c.grupo : ""})`),
    );
  }

  return mapaExistentes;
}

async function seedGastosRecurrentes(categoriasMapa: Map<string, string>) {
  console.log("\n🔄 Sembrando gastos recurrentes...");

  const { data: existentes, error } = await supabaseAdmin
    .from("gastos_recurrentes")
    .select("nombre")
    .eq("user_id", userId);

  if (error) {
    // La tabla puede no existir si el schema no se corrió todavía
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.log("  ⚠️  Tabla gastos_recurrentes no encontrada. Corriendo el schema SQL primero.");
      return;
    }
    console.error("  Error:", error.message);
    return;
  }

  const nombresExistentes = new Set((existentes ?? []).map((g) => g.nombre));
  const faltantes = GASTOS_RECURRENTES_SEMILLA.filter((g) => !nombresExistentes.has(g.nombre));

  if (faltantes.length === 0) {
    console.log("  ✓ Todos los gastos recurrentes de semilla ya existen.");
    return;
  }

  // Buscar una categoría de egreso fijo para asignar
  const categoriaFija = [...categoriasMapa.entries()].find(([nombre]) =>
    ["Suscripciones digitales", "Servicios básicos"].includes(nombre),
  )?.[1] ?? null;

  const { error: errorInsercion } = await supabaseAdmin
    .from("gastos_recurrentes")
    .insert(
      faltantes.map((g) => ({
        ...g,
        user_id: userId,
        categoria_id: categoriaFija,
      })),
    );

  if (errorInsercion) {
    console.error("  Error insertando gastos recurrentes:", errorInsercion.message);
    return;
  }

  console.log(`  ✓ ${faltantes.length} gasto(s) recurrente(s) creado(s).`);
  faltantes.forEach((g) => console.log(`    - ${g.nombre}: $${g.monto}/mes (día ${g.dia_cobro})`));
}

async function main() {
  console.log(`\n🌱 Iniciando seed para user_id=${userId}...`);

  const categoriasMapa = await seedCategorias();
  await seedGastosRecurrentes(categoriasMapa);

  console.log("\n✅ Seed completado con éxito.\n");
}

main().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
