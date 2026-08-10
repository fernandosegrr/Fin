/**
 * Script de administración — corre FUERA del runtime de Next.js, usando
 * Prisma con conexión directa a Postgres (bypassa RLS a propósito) para
 * poder insertar datos de semilla para un user_id específico antes de que
 * ese usuario tenga sesión.
 *
 * Uso:
 *   npm run seed -- <user_id>
 *   (o define SEED_USER_ID en .env.local y corre: npm run seed)
 *
 * El user_id es el UUID de auth.users — cópialo desde Supabase Dashboard →
 * Authentication → Users, después de crear tu cuenta desde /login.
 *
 * Nunca importes este archivo desde código de la app (usa conexión directa).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TipoCategoria, GrupoCategoria } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
const userId = process.argv[2] ?? process.env.SEED_USER_ID;

if (!DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.local. Ver .env.example.");
  process.exit(1);
}
if (!userId) {
  console.error(
    "Falta el user_id. Uso: npm run seed -- <user_id>  (o define SEED_USER_ID en .env.local)",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

interface SemillaCategoria {
  nombre: string;
  tipo: TipoCategoria;
  grupo: GrupoCategoria | null;
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

async function seedCategorias(userId: string): Promise<Map<string, string>> {
  console.log("\n📂 Sembrando categorías...");

  const existentes = await prisma.categoria.findMany({
    where: { userId },
    select: { id: true, nombre: true },
  });

  const mapaExistentes = new Map(existentes.map((c) => [c.nombre, c.id]));
  const faltantes = CATEGORIAS_SEMILLA.filter((c) => !mapaExistentes.has(c.nombre));

  if (faltantes.length === 0) {
    console.log("  ✓ Todas las categorías semilla ya existen.");
  } else {
    const insertadas = await prisma.categoria.createManyAndReturn({
      data: faltantes.map((c) => ({
        userId,
        nombre: c.nombre,
        tipo: c.tipo,
        grupo: c.grupo,
      })),
      select: { id: true, nombre: true },
    });

    insertadas.forEach((c) => mapaExistentes.set(c.nombre, c.id));
    console.log(`  ✓ ${faltantes.length} categoría(s) creada(s).`);
    faltantes.forEach((c) =>
      console.log(`    - ${c.nombre} (${c.tipo}${c.grupo ? "/" + c.grupo : ""})`),
    );
  }

  return mapaExistentes;
}

async function seedGastosRecurrentes(userId: string, categoriasMapa: Map<string, string>) {
  console.log("\n🔄 Sembrando gastos recurrentes...");

  const existentes = await prisma.gastoRecurrente.findMany({
    where: { userId },
    select: { nombre: true },
  });

  const nombresExistentes = new Set(existentes.map((g) => g.nombre));
  const faltantes = GASTOS_RECURRENTES_SEMILLA.filter((g) => !nombresExistentes.has(g.nombre));

  if (faltantes.length === 0) {
    console.log("  ✓ Todos los gastos recurrentes de semilla ya existen.");
    return;
  }

  // Buscar una categoría de egreso fijo para asignar
  const categoriaFija = [...categoriasMapa.entries()].find(([nombre]) =>
    ["Suscripciones digitales", "Servicios básicos"].includes(nombre),
  )?.[1] ?? null;

  await prisma.gastoRecurrente.createMany({
    data: faltantes.map((g) => ({
      nombre: g.nombre,
      monto: g.monto,
      diaCobro: g.dia_cobro,
      metodoPago: g.metodo_pago,
      userId,
      categoriaId: categoriaFija,
    })),
  });

  console.log(`  ✓ ${faltantes.length} gasto(s) recurrente(s) creado(s).`);
  faltantes.forEach((g) => console.log(`    - ${g.nombre}: $${g.monto}/mes (día ${g.dia_cobro})`));
}

async function main() {
  console.log(`\n🌱 Iniciando seed para user_id=${userId}...`);

  const categoriasMapa = await seedCategorias(userId!);
  await seedGastosRecurrentes(userId!, categoriasMapa);

  console.log("\n✅ Seed completado con éxito.\n");
}

main()
  .catch((err) => {
    console.error("❌ Error en seed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
