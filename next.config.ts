import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Ancla la raíz del workspace a este proyecto: evita que Next.js la infiera
  // mal si existe otro package-lock.json más arriba en el árbol de carpetas.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
