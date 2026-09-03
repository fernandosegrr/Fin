import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Cliente de Supabase para Server Components y Server Actions. Opera con
 * la sesión del usuario autenticado (vía cookies), nunca con la secret key,
 * para que auth.uid() resuelva correctamente dentro de las políticas RLS.
 *
 * Memoizado por petición con `cache()` de React — y esto NO es una
 * optimización cosmética, arregla un fallo real de la primera carga:
 *
 * DashboardPage llamaba a createClient() cinco veces en la misma petición
 * (el guard de auth más las cuatro lecturas del Promise.all). Cada llamada
 * creaba un cliente independiente que leía las MISMAS cookies. Si el access
 * token venía vencido (justo lo que pasa al abrir la app después de un rato),
 * los cinco intentaban refrescarlo a la vez con el mismo refresh token: uno
 * ganaba y los otros recibían "Invalid Refresh Token: Already Used" → 401 →
 * las lecturas lanzaban → se pintaba error.tsx ("No se pudo cargar el
 * dashboard"). Al recargar ya había token nuevo y todo funcionaba, que es
 * exactamente el síntoma de "falla la primera vez y luego carga".
 *
 * Un Server Component además NO puede escribir cookies (ver el catch de
 * abajo), así que el token refrescado por el primer cliente no quedaba
 * disponible para los otros cuatro ni siquiera en el mismo render.
 *
 * Con cache(), las cinco llamadas comparten UNA instancia: un solo refresh.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llamó desde un Server Component (no puede escribir cookies).
            // El middleware se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    },
  );
});
