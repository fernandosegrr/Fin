import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

/**
 * `datasource.url` es lo que usa el Prisma CLI (`migrate deploy`, `migrate
 * resolve`, `db pull`...) — por eso apunta a DIRECT_URL y no a la pooled
 * (pgbouncer en modo transacción no soporta los prepared statements que las
 * migraciones necesitan). PrismaClient en runtime (scripts/seed.ts) se
 * configura aparte, con su propio adapter apuntando a DATABASE_URL (pooled).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Generar el cliente no necesita acceso a Postgres. Las migraciones siguen
  // requiriendo una URL directa configurada explícitamente.
  ...(process.env.DIRECT_URL ? { datasource: { url: process.env.DIRECT_URL } } : {}),
});
