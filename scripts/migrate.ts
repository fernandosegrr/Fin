import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

async function main() {
  const projectRef = SUPABASE_URL?.replace("https://", "").split(".")[0];
  console.log(`Intentando ejecutar SQL DDL en el proyecto ${projectRef}...`);

  const sql = "ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'tarjeta';";

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SECRET_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    const body = await res.text();
    console.log("Status:", res.status);
    console.log("Respuesta:", body);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
