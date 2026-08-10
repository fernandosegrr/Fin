import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

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
  datasource: {
    url: env("DIRECT_URL"),
  },
});
