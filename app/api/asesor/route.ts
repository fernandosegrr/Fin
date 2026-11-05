import { enviarMensajeAsesorConProgreso } from "@/lib/advisor/message";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Origen no permitido", { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 20000) return new Response("Mensaje demasiado largo", { status: 413 });
  let body: { contenido?: unknown; anio?: unknown; mes?: unknown; solicitudId?: unknown };
  try { body = await request.json(); } catch { return new Response("Solicitud inválida", { status: 400 }); }
  if (typeof body.contenido !== "string" || body.contenido.length > 4000 || typeof body.solicitudId !== "string") return new Response("Mensaje inválido", { status: 400 });
  const contenido = body.contenido, solicitudId = body.solicitudId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let abierto = true;
      function emitir(evento: unknown) { if (abierto) { try { controller.enqueue(encoder.encode(`${JSON.stringify(evento)}\n`)); } catch { abierto = false; } } }
      try {
        const resultado = await enviarMensajeAsesorConProgreso(contenido, Number(body.anio), Number(body.mes), solicitudId, estado => emitir({ tipo: "progreso", estado }));
        emitir({ tipo: "resultado", resultado });
      } catch { emitir({ tipo: "resultado", resultado: { ok: false, error: "No se pudo completar la solicitud. Puedes recuperar su estado al reintentar." } }); }
      finally { if (abierto) { try { controller.close(); } catch { /* Cliente desconectado. */ } } }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
