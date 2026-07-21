import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para Client Components. Usa la publishable key:
 * es segura para el navegador porque RLS protege cada tabla.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
