import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/manifest.json", "/sw.js"];

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Si no están configuradas las variables en Vercel, continuar la petición sin hacer fallar el middleware
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Reconstruir cabecera "cookie" en request.headers para que los Server Components
          // de Next.js 15 aguas abajo lean los tokens refrescados en la misma petición (evita
          // 401 y el error "Invalid Refresh Token: Already Used").
          const cookieHeader = request.cookies
            .getAll()
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
          request.headers.set("cookie", cookieHeader);
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      request.nextUrl.pathname.startsWith(route),
    );

    // getUser() puede haber rotado el refresh token y escrito las cookies nuevas
    // en supabaseResponse. Un redirect crea una respuesta NUEVA sin esas cookies,
    // así que hay que copiarlas explícitamente o el token rotado se pierde y la
    // siguiente petición falla con "Invalid Refresh Token: Already Used".
    const redirigirCon = (pathname: string) => {
      const url = request.nextUrl.clone();
      url.pathname = pathname;
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    };

    // Redirección directa desde la raíz preservando cookies actualizadas
    if (request.nextUrl.pathname === "/") {
      return redirigirCon(user ? "/dashboard" : "/login");
    }

    if (!user && !isPublicRoute) {
      return redirigirCon("/login");
    }

    if (user && isPublicRoute) {
      return redirigirCon("/dashboard");
    }
  } catch (err) {
    console.error("Error en middleware de Supabase:", err);
  }

  return supabaseResponse;
}
