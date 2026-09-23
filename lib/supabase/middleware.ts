import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esErrorTransitorio } from "./retry";

const PUBLIC_ROUTES = ["/login", "/manifest.json", "/sw.js"];

type CookieToSet = { name: string; value: string; options: CookieOptions };

function sinCache(response: NextResponse): NextResponse {
  // También protege los redirects sin Set-Cookie: dependen de la sesión.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Si faltan variables, la página mostrará el error de configuración.
  if (!supabaseUrl || !supabaseKey) {
    return sinCache(NextResponse.next({ request }));
  }

  let supabaseResponse = sinCache(NextResponse.next({
    request: {
      headers: request.headers,
    },
  }));

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[], headers: Record<string, string>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // request.cookies.set() ya actualiza la cabecera Cookie. La respuesta
          // nueva pasa los tokens rotados al render y al navegador.
          supabaseResponse = sinCache(NextResponse.next({
            request: {
              headers: request.headers,
            },
          }));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();
    const autenticado = Boolean(data?.claims?.sub);

    // Un corte de Auth no invalida las cookies. Dejar que la página intente
    // de nuevo evita expulsar al usuario durante un fallo breve del servicio.
    if (error && esErrorTransitorio(error)) {
      console.warn("Error temporal al verificar sesión en middleware:", error);
      return supabaseResponse;
    }

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      request.nextUrl.pathname.startsWith(route),
    );

    // getClaims() puede haber rotado el refresh token y escrito las cookies nuevas
    // en supabaseResponse. Un redirect crea una respuesta NUEVA sin esas cookies,
    // así que hay que copiarlas explícitamente o el token rotado se pierde y la
    // siguiente petición falla con "Invalid Refresh Token: Already Used".
    const redirigirCon = (pathname: string) => {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      const redirectResponse = sinCache(NextResponse.redirect(url));
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      for (const key of ["Cache-Control", "Expires", "Pragma"]) {
        const value = supabaseResponse.headers.get(key);
        if (value) redirectResponse.headers.set(key, value);
      }
      return redirectResponse;
    };

    // Redirección directa desde la raíz preservando cookies actualizadas
    if (request.nextUrl.pathname === "/") {
      return redirigirCon(autenticado ? "/dashboard" : "/login");
    }

    if (!autenticado && !isPublicRoute) {
      return redirigirCon("/login");
    }

    if (autenticado && isPublicRoute) {
      return redirigirCon("/dashboard");
    }
  } catch (err) {
    console.error("Error en middleware de Supabase:", err);
  }

  return supabaseResponse;
}
