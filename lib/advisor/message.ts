import { createClient } from "@/lib/supabase/server";
import { esMesCalendario, hoyEnMexico } from "@/lib/dates";
import { obtenerDatosDashboard } from "@/lib/dashboard/dashboard";
import { COOLDOWN_MENSAJE_MS, MAX_CARACTERES_MENSAJE, MAX_ITERACIONES_TOOL, MAX_MENSAJES_POR_HORA, MAX_NOTAS_MEMORIA, MENSAJES_CONTEXTO_MODELO } from "./config";
import { obtenerTendenciaMensual } from "./trend";
import { construirSystemPrompt } from "./prompt";
import { llamarOpenAI, type MensajeOpenAI } from "./openai";
import {
  ejecutarEditarMovimiento,
  ejecutarEliminarMovimiento,
  ejecutarGuardarNotaMemoria,
  ejecutarRegistrarMovimiento,
} from "./tools";
import { textoDeError } from "./utils";
import type { ResultadoMensajeAsesor } from "./types";
import type { MensajeAsesor } from "@/lib/types";
import { consultarMovimientosFinancieros, ejecutarHerramientaFinanciera, TOOLS_FINANCIERAS_MUTANTES } from "./finance-tools";
import { claveAccion, guardarAcciones, iniciarSolicitud, resumenAcciones, type AccionAsesor } from "./requests";

export async function enviarMensajeAsesor(
  contenidoCrudo: string,
  anioVista?: number,
  mesVista?: number,
  solicitudId?: string,
): Promise<ResultadoMensajeAsesor> {
  return ejecutarMensaje(contenidoCrudo, anioVista, mesVista, solicitudId || crypto.randomUUID());
}

export async function enviarMensajeAsesorConProgreso(contenido: string, anio: number, mes: number, solicitudId: string, progreso: (estado: string) => void) {
  return ejecutarMensaje(contenido, anio, mes, solicitudId, progreso);
}

async function ejecutarMensaje(contenidoCrudo: string, anioVista: number | undefined, mesVista: number | undefined, solicitudId: string, progreso?: (estado: string) => void): Promise<ResultadoMensajeAsesor> {
  const ejecucion = { propia: false };
  let resultado: ResultadoMensajeAsesor;
  try {
    resultado = await enviarMensajeAsesorInterno(contenidoCrudo, anioVista, mesVista, solicitudId, ejecucion, progreso);
  } catch (err) {
    // Última red de seguridad: nada debe salir de aquí como excepción, o
    // Next.js lo redacta en producción y el usuario pierde el detalle real
    // (ver el comentario de ResultadoMensajeAsesor arriba).
    console.error("Error en enviarMensajeAsesor:", err);
    resultado = { ok: false, error: textoDeError(err, "No se pudo obtener respuesta del asesor.") };
  }
  if (!resultado.ok && ejecucion.propia) {
    try {
      const db = await createClient();
      const r = await db.from("solicitudes_asesor").select("acciones").eq("id", solicitudId).maybeSingle();
      const acciones = (r.data?.acciones || []) as AccionAsesor[];
      if (acciones.some(a => a.estado !== "fallida")) resultado = { ...resultado, datosModificados: true, error: `${resultado.error}\n\n${resumenAcciones(acciones)}\n\nRevisa los movimientos actualizados antes de repetir una acción.` };
      await db.from("solicitudes_asesor").update({ estado: "error", actualizado_en: new Date().toISOString() }).eq("id", solicitudId);
    } catch { /* La solicitud persiste; un reintento no reejecuta un proceso pendiente. */ }
  }
  return resultado;
}

async function enviarMensajeAsesorInterno(
  contenidoCrudo: string,
  anioVista?: number,
  mesVista?: number,
  solicitudId = crypto.randomUUID(),
  ejecucion = { propia: false },
  progreso?: (estado: string) => void,
): Promise<ResultadoMensajeAsesor> {
  const contenido = contenidoCrudo.trim();
  if (!contenido) return { ok: false, error: "Escribe un mensaje antes de enviar." };
  if (contenido.length > MAX_CARACTERES_MENSAJE) {
    return { ok: false, error: `Tu mensaje es demasiado largo (máximo ${MAX_CARACTERES_MENSAJE} caracteres).` };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "El asesor no está configurado todavía (falta OPENAI_API_KEY en el servidor)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  const solicitud = await iniciarSolicitud(supabase, user.id, solicitudId, contenido);
  if (!solicitud.continuar) return solicitud.resultado;
  ejecucion.propia = true;
  progreso?.("Consultando tus saldos, movimientos y compromisos…");

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: ultimoMensaje }, { count: mensajesHora, error: errorCuenta }] = await Promise.all([
    supabase
      .from("mensajes_asesor")
      .select("creado_en")
      .eq("rol", "usuario")
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("mensajes_asesor")
      .select("id", { count: "exact", head: true })
      .eq("rol", "usuario")
      .gte("creado_en", haceUnaHora),
  ]);
  if (errorCuenta) {
    console.error("Error contando mensajes del asesor:", errorCuenta);
  }
  if ((mensajesHora ?? 0) >= MAX_MENSAJES_POR_HORA) {
    return {
      ok: false,
      error: `Llegaste al límite de ${MAX_MENSAJES_POR_HORA} mensajes por hora. Intenta más tarde.`,
    };
  }
  if (!solicitud.reintento && ultimoMensaje?.creado_en) {
    const transcurrido = Date.now() - new Date(ultimoMensaje.creado_en as string).getTime();
    if (transcurrido >= 0 && transcurrido < COOLDOWN_MENSAJE_MS) {
      return { ok: false, error: "Espera un momento antes de enviar otro mensaje." };
    }
  }

  // El asesor razona sobre el mes que el usuario tiene ABIERTO, no sobre el
  // mes de hoy: si está revisando julio y pregunta "¿cómo voy este mes?",
  // antes se le contestaba con las cifras de septiembre.
  const hoy = hoyEnMexico();
  const anio = esMesCalendario(anioVista ?? 0, mesVista ?? 0) ? anioVista! : hoy.anio;
  const mes = esMesCalendario(anioVista ?? 0, mesVista ?? 0) ? mesVista! : hoy.mes;
  const esMesEnCurso = anio === hoy.anio && mes === hoy.mes;

  // Se guarda ANTES de llamar al modelo: si la llamada a la API falla, el
  // mensaje del usuario no se pierde.
  const { error: errorInsertUsuario } = await supabase
    .from("mensajes_asesor")
    .insert({ user_id: user.id, rol: "usuario", contenido, solicitud_id: solicitudId });
  if (errorInsertUsuario && errorInsertUsuario.code !== "23505") return { ok: false, error: `No se pudo guardar tu mensaje: ${errorInsertUsuario.message}` };

  // El dashboard ya limita la concurrencia y reintenta lecturas temporales.
  const { balance, presupuestos, gastosRecurrentes, categorias, clientes, meta } =
    await obtenerDatosDashboard(anio, mes);
  const [tendencia, resNotas, resHistorial] = await Promise.all([
    obtenerTendenciaMensual(supabase, anio, mes),
    supabase.from("notas_memoria_asesor").select("contenido").order("creado_en", { ascending: false }).limit(MAX_NOTAS_MEMORIA),
    supabase.from("mensajes_asesor").select("rol, contenido").order("creado_en", { ascending: false }).limit(MENSAJES_CONTEXTO_MODELO),
  ]);

  if (resNotas.error) return { ok: false, error: `No se pudo cargar la memoria del asesor: ${resNotas.error.message}` };
  if (resHistorial.error) return { ok: false, error: `No se pudo cargar el historial: ${resHistorial.error.message}` };

  const notas = (resNotas.data ?? []).map((n) => n.contenido as string).reverse();
  const historial = (resHistorial.data ?? []).reverse() as { rol: string; contenido: string }[];

  // La ventana de los últimos N mensajes puede empezar a mitad de un turno
  // (p. ej. si un intento anterior falló antes de guardar su respuesta de
  // asistente) — evita que el primer mensaje de la ventana quede huérfano.
  while (historial.length > 0 && historial[0].rol !== "usuario") historial.shift();

  const systemPrompt = construirSystemPrompt({
    balance,
    presupuestos,
    gastosRecurrentes,
    tendencia,
    notas,
    esMesEnCurso,
    categorias,
    clientes,
    metaNombre: meta?.nombre ?? null,
    metaObjetivo: meta?.monto_objetivo ?? null,
  });
  let mensajesConversacion: MensajeOpenAI[] = [
    { role: "system", content: systemPrompt },
    ...historial.map((m): MensajeOpenAI => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.contenido })),
  ];

  let mensajeFinal: MensajeOpenAI | null = null;
  let tokensEntrada = 0;
  let tokensSalida = 0;
  let datosModificados = false;
  const acciones: AccionAsesor[] = [];

  try {
    for (let intento = 0; intento < MAX_ITERACIONES_TOOL; intento++) {
      const esUltimaIteracion = intento === MAX_ITERACIONES_TOOL - 1;
      progreso?.(datosModificados ? "Comprobando los cambios y preparando la respuesta…" : "Analizando tus datos…");
      const response = await llamarOpenAI(mensajesConversacion, { conHerramientas: !esUltimaIteracion });

      if (response.usage) {
        tokensEntrada += response.usage.prompt_tokens;
        tokensSalida += response.usage.completion_tokens;
      }

      const mensaje = response.choices[0].message;
      mensajeFinal = mensaje;

      if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) break;

      mensajesConversacion = [...mensajesConversacion, mensaje];

      for (const llamada of mensaje.tool_calls) {
        const nombreTool = llamada.function.name;
        const args = llamada.function.arguments;
        let textoResultado: string;
        const mutante = ["registrar_movimiento", "editar_movimiento", "eliminar_movimiento", ...TOOLS_FINANCIERAS_MUTANTES].includes(nombreTool);
        const clave = await claveAccion(solicitudId, nombreTool, args);
        const repetida = acciones.find(a => a.clave === clave);
        if (repetida) {
          mensajesConversacion.push({ role: "tool", tool_call_id: llamada.id, content: repetida.resultado || "La acción ya fue iniciada; consulta su resultado, no la repitas." });
          continue;
        }
        if (mutante) { acciones.push({ clave, herramienta: nombreTool, estado: "iniciada" }); await guardarAcciones(supabase, solicitudId, acciones); }
        progreso?.(mutante ? "Guardando la acción solicitada…" : "Consultando el detalle completo…");

        if (nombreTool === "guardar_nota_memoria") {
          textoResultado = await ejecutarGuardarNotaMemoria(supabase, user.id, args);
        } else if (nombreTool === "registrar_movimiento") {
          const res = await ejecutarRegistrarMovimiento(args, clave);
          textoResultado = res.texto;
          if (res.modificado) datosModificados = true;
        } else if (nombreTool === "consultar_movimientos") {
          textoResultado = await consultarMovimientosFinancieros(args);
        } else if (nombreTool === "editar_movimiento") {
          const res = await ejecutarEditarMovimiento(supabase, user.id, args);
          textoResultado = res.texto;
          if (res.modificado) datosModificados = true;
        } else if (nombreTool === "eliminar_movimiento") {
          const res = await ejecutarEliminarMovimiento(supabase, user.id, args);
          textoResultado = res.texto;
          if (res.modificado) datosModificados = true;
        } else {
          const res = await ejecutarHerramientaFinanciera(nombreTool, args, supabase, user.id, clave, anio, mes);
          textoResultado = res.texto;
          if (res.modificado) datosModificados = true;
        }
        if (mutante) {
          const accion = acciones[acciones.length - 1];
          accion.estado = /^Error[: ]/i.test(textoResultado) ? "fallida" : "realizada";
          accion.resultado = textoResultado;
          await guardarAcciones(supabase, solicitudId, acciones);
        }

        mensajesConversacion = [
          ...mensajesConversacion,
          { role: "tool", tool_call_id: llamada.id, content: textoResultado },
        ];
      }
    }
  } catch (err) {
    console.error("Error llamando a la API de OpenAI:", err);
    // llamarOpenAI() ya normaliza todo a un mensaje en español; se devuelve
    // como dato (no se lanza) para que llegue íntegro al cliente en prod.
    if (acciones.some(a => a.estado === "realizada") && !acciones.some(a => a.estado === "iniciada")) {
      mensajeFinal = { role: "assistant", content: `Se completaron estas acciones:\n\n${resumenAcciones(acciones)}\n\nLa explicación del asistente no pudo terminar, pero los cambios guardados ya están disponibles.` };
    } else return { ok: false, datosModificados, error: textoDeError(err, "No se pudo conectar con el asesor.") };
  }

  // No basta con `?? fallback`: un modelo de razonamiento sin presupuesto
  // suficiente puede devolver content como string vacío (no null/undefined),
  // que ?? no captura.
  const contenidoBruto = mensajeFinal?.content?.trim();
  const textoRespuesta =
    contenidoBruto && contenidoBruto.length > 0
      ? contenidoBruto
      : "No pude generar una respuesta esta vez. Intenta reformular tu mensaje.";

  const { data: mensajeGuardado, error: errorInsertAsistente } = await supabase
    .from("mensajes_asesor")
    .insert({
      user_id: user.id,
      rol: "asistente",
      contenido: textoRespuesta,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      solicitud_id: solicitudId,
    })
    .select("id, rol, contenido, creado_en")
    .single();
  await supabase.from("solicitudes_asesor").update({ estado: "completado", respuesta: textoRespuesta, mensaje_id: mensajeGuardado?.id || null, actualizado_en: new Date().toISOString() }).eq("id", solicitudId);

  if (errorInsertAsistente) {
    console.error("No se pudo guardar la respuesta del asesor:", errorInsertAsistente);
    // Se regresa igual al cliente: ya se generó y se pagó el costo de la
    // llamada a la API, no tiene sentido perderla por un fallo de guardado.
    return {
      ok: true,
      datosModificados,
      mensajeAsistente: {
        id: `temp-${Date.now()}`,
        rol: "asistente",
        contenido: textoRespuesta,
        creado_en: new Date().toISOString(),
      },
    };
  }

  return { ok: true, datosModificados, mensajeAsistente: mensajeGuardado as MensajeAsesor };
}
