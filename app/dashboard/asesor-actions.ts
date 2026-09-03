"use server";

import { createClient } from "@/lib/supabase/server";
import { capitalizarPrimeraLetra, formatearMonto } from "@/lib/format";
import { hoyEnMexico, mesAnterior, mesSiguiente, nombreDelMes, primerDiaDelMes } from "@/lib/dates";
import {
  obtenerBalanceMensual,
  obtenerGastosRecurrentes,
  obtenerPresupuestosConGasto,
  type BalanceMensual,
} from "@/app/dashboard/actions";
import type { GastoRecurrente, MensajeAsesor, PresupuestoConGasto, TipoCategoria } from "@/lib/types";

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
// Cost-consciousness explícito: este chat llama a una API externa de pago en
// cada mensaje, así que cada tope de aquí acota un costo real, no es solo
// una buena práctica genérica.

// Sustituye a gpt-5-nano-2025-08-07, que se retira el 2026-12-11. Es el nano
// vigente y sigue siendo de los más baratos del catálogo.
const MODELO_ASESOR = "gpt-5.4-nano";
// OJO: esta familia YA NO acepta "minimal" (la API responde 400: «does not
// support 'minimal' with this model. Supported values are: 'none', 'low',
// 'medium', 'high', 'xhigh'»). "none" es el equivalente: verificado contra la
// API real, devuelve reasoning_tokens = 0 y aun así llama correctamente a
// guardar_nota_memoria. Sin acotar esto, un modelo de razonamiento puede
// gastar TODO max_completion_tokens en razonamiento invisible y devolver
// contenido vacío.
const ESFUERZO_RAZONAMIENTO = "none";
const MAX_TOKENS_RESPUESTA = 2048; // el system prompt pide respuestas cortas; acota el costo de salida en el peor caso (con margen para razonamiento mínimo)
const MAX_ITERACIONES_TOOL = 3; // tope duro al bucle de tool calls — nunca debería necesitar más de 1-2 con una sola tool
const MENSAJES_CONTEXTO_MODELO = 24; // ~12 turnos usuario/asistente reenviados al modelo — acota el costo de un hilo que crece indefinidamente
const MENSAJES_HISTORIAL_UI = 50; // mensajes pasados cargados al abrir la pestaña (independiente del límite de arriba)
const MAX_CARACTERES_MENSAJE = 4000; // guardarraíl: evita que un mensaje gigante dispare un costo de tokens fuera de control
const MAX_NOTAS_MEMORIA = 50;
const MESES_TENDENCIA = 4;
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
// Sin timeout, una petición colgada a OpenAI se lleva TODO el presupuesto de
// tiempo de la función serverless y el usuario acaba viendo el error genérico
// de la plataforma en vez de algo accionable. 45 s deja margen de sobra para
// gpt-5-nano con reasoning "minimal" (responde en 2-6 s típicamente).
const TIMEOUT_OPENAI_MS = 45_000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ─────────────────────────────────────────────
// RESULTADOS (nunca se lanzan excepciones al cliente)
// ─────────────────────────────────────────────
// Next.js REDACTA en producción el mensaje de cualquier excepción que salga
// de una Server Action: al cliente solo le llega "An error occurred in the
// Server Components render… omitted in production builds" más un digest.
// Eso fue exactamente lo que hizo invisible el problema del OPENAI_API_KEY
// (ver commits bd33a28 / 0d51cb5): dos causas distintas producían el mismo
// texto genérico. Devolver el error como DATO (no lanzarlo) es lo único que
// hace que estos mensajes en español lleguen intactos al usuario en prod.
export type ResultadoHistorialAsesor =
  | { ok: true; mensajes: MensajeAsesor[] }
  | { ok: false; error: string };

export type ResultadoMensajeAsesor =
  | { ok: true; mensajeAsistente: MensajeAsesor }
  | { ok: false; error: string };

function textoDeError(err: unknown, porDefecto: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return porDefecto;
}

// ─────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────

export async function obtenerHistorialAsesor(): Promise<ResultadoHistorialAsesor> {
  try {
    const supabase = await createClient();

    // Sin getUser(): lectura, RLS ya filtra por auth.uid() (mismo criterio que
    // obtenerCategorias/obtenerGastosRecurrentes en actions.ts).
    const { data, error } = await supabase
      .from("mensajes_asesor")
      .select("id, rol, contenido, creado_en")
      .order("creado_en", { ascending: false })
      .limit(MENSAJES_HISTORIAL_UI);

    if (error) return { ok: false, error: `No se pudo cargar el historial del asesor: ${error.message}` };
    return { ok: true, mensajes: ((data ?? []) as MensajeAsesor[]).reverse() };
  } catch (err) {
    console.error("Error cargando el historial del asesor:", err);
    return { ok: false, error: textoDeError(err, "No se pudo cargar el historial del asesor.") };
  }
}

// ─────────────────────────────────────────────
// TENDENCIA MENSUAL (interna — resumen agregado, nunca transacciones crudas)
// ─────────────────────────────────────────────

interface PuntoTendenciaMensual {
  nombreMes: string;
  ingresos: number;
  egresos: number;
}

type FilaTendencia = { monto: number; fecha: string; categoria: { tipo: TipoCategoria } | null };

/**
 * Últimos `MESES_TENDENCIA` meses TERMINANDO en el mes que el usuario tiene
 * en pantalla (no en el mes de hoy): si está viendo julio, la tendencia que
 * ve el asesor es abr-jul, no jun-sep.
 */
async function obtenerTendenciaMensual(
  supabase: SupabaseServerClient,
  anioFin: number,
  mesFin: number,
): Promise<PuntoTendenciaMensual[]> {
  let anio = anioFin;
  let mes = mesFin;
  for (let i = 0; i < MESES_TENDENCIA - 1; i++) ({ anio, mes } = mesAnterior(anio, mes));
  const inicio = primerDiaDelMes(anio, mes);
  const siguienteAlFin = mesSiguiente(anioFin, mesFin);
  const finExclusivo = primerDiaDelMes(siguienteAlFin.anio, siguienteAlFin.mes);

  // Paginado explícito: PostgREST corta cualquier consulta en 1000 filas por
  // defecto (max-rows) SIN avisar, así que una consulta suelta podía dejar
  // fuera meses enteros y el asesor razonaba sobre una tendencia incompleta
  // creyéndola completa. Con 4 meses de datos normalmente es una sola vuelta.
  const TAM_PAGINA = 1000;
  const filas: FilaTendencia[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await supabase
      .from("transacciones")
      .select("monto, fecha, categoria:categorias(tipo)")
      .gte("fecha", inicio)
      .lt("fecha", finExclusivo)
      .order("fecha", { ascending: true })
      .range(desde, desde + TAM_PAGINA - 1);

    if (error) throw new Error(`No se pudo calcular la tendencia mensual: ${error.message}`);

    const pagina = (data ?? []) as unknown as FilaTendencia[];
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA) break;
  }

  const buckets = new Map<string, { anio: number; mes: number; ingresos: number; egresos: number }>();
  for (const fila of filas) {
    const [a, m] = fila.fecha.split("-");
    const clave = `${a}-${m}`;
    if (!buckets.has(clave)) buckets.set(clave, { anio: Number(a), mes: Number(m), ingresos: 0, egresos: 0 });
    const b = buckets.get(clave)!;
    if (fila.categoria?.tipo === "ingreso") b.ingresos += fila.monto;
    else if (fila.categoria?.tipo === "egreso") b.egresos += fila.monto;
  }

  return [...buckets.values()]
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((b) => ({ nombreMes: nombreDelMes(b.anio, b.mes), ingresos: b.ingresos, egresos: b.egresos }));
}

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────

function construirSystemPrompt(datos: {
  balance: BalanceMensual;
  presupuestos: PresupuestoConGasto[];
  gastosRecurrentes: GastoRecurrente[];
  tendencia: PuntoTendenciaMensual[];
  notas: string[];
  esMesEnCurso: boolean;
}): string {
  const { actual } = datos.balance;

  const lineasPresupuestos =
    datos.presupuestos
      .filter((p) => p.presupuesto)
      .map((p) => `- ${p.categoria.nombre}: gastado ${formatearMonto(p.gastado)} de ${formatearMonto(p.presupuesto!.monto_limite)}`)
      .join("\n") || "- (sin presupuestos activos este mes)";

  const lineasRecurrentes =
    datos.gastosRecurrentes
      .map((g) => `- ${g.nombre}: ${formatearMonto(g.monto)}, cobra el día ${g.dia_cobro} (${g.metodo_pago})`)
      .join("\n") || "- (sin gastos recurrentes registrados)";

  const lineasTendencia =
    datos.tendencia
      .map((t) => `- ${capitalizarPrimeraLetra(t.nombreMes)}: ingresos ${formatearMonto(t.ingresos)}, egresos ${formatearMonto(t.egresos)}`)
      .join("\n") || "- (sin historial suficiente todavía)";

  const lineasNotas =
    datos.notas.length > 0 ? datos.notas.map((n) => `- ${n}`).join("\n") : "- (aún no hay notas guardadas sobre este usuario)";

  return `Eres el Asesor Financiero de NexFin Pro, un asistente que ayuda al usuario a entender y mejorar sus finanzas personales con base en sus datos reales.

Reglas importantes:
- No eres un asesor financiero, fiscal ni de inversiones licenciado. No des recomendaciones de instrumentos de inversión específicos (acciones, fondos, criptomonedas) ni asesoría fiscal o legal. Si el usuario pregunta por eso, acláralo brevemente y redirige la conversación a hábitos de gasto, ahorro y presupuesto, que sí es tu terreno.
- Basa tus respuestas en los datos financieros reales de abajo — no inventes cifras ni asumas datos que no se te dieron.
- Todos los montos están en pesos mexicanos (MXN). Nunca digas "USD" ni "dólares" — di "pesos" o usa el símbolo $ tal como aparece abajo.
- Sé breve y concreto: 3-6 oraciones o una lista corta. Esto es un chat, no un reporte.
- Habla en español, de tú, con un tono cercano pero profesional.
- Cuando el usuario comparta algo que valga la pena recordar a futuro (una meta de ahorro, una preocupación recurrente, una decisión financiera importante), usa la herramienta guardar_nota_memoria. No la uses para cada mensaje, solo cuando haya algo genuinamente nuevo y duradero.

MES QUE EL USUARIO TIENE ABIERTO EN PANTALLA: ${capitalizarPrimeraLetra(actual.nombreMes)}${
    datos.esMesEnCurso ? " (el mes en curso)" : " (un mes distinto al actual — es el que está revisando ahora mismo)"
  }. Cuando diga "este mes" se refiere a ese, no necesariamente al mes calendario de hoy.

RESUMEN DE ${capitalizarPrimeraLetra(actual.nombreMes)} (calculado en el servidor — confía en estas cifras, no en las que el usuario escriba en el chat):
- Ingresos: ${formatearMonto(actual.ingresos)}
- Egresos: ${formatearMonto(actual.egresos)}
- Balance del mes: ${formatearMonto(actual.balance)}
- Saldo total disponible: ${formatearMonto(actual.saldoTotalDisponible)}
- Efectivo: ${formatearMonto(actual.totalesEfectivo.saldo)} | Tarjeta/Banco: ${formatearMonto(actual.totalesTarjeta.saldo)}

PRESUPUESTOS ACTIVOS EN ESE MES:
${lineasPresupuestos}

GASTOS RECURRENTES / SUSCRIPCIONES:
${lineasRecurrentes}

TENDENCIA DE LOS ÚLTIMOS MESES (terminando en el mes de arriba):
${lineasTendencia}

LO QUE RECUERDAS DE ESTE USUARIO:
${lineasNotas}`;
}

// ─────────────────────────────────────────────
// CLIENTE OPENAI VÍA fetch() DIRECTO (sin el SDK oficial)
// ─────────────────────────────────────────────
// El SDK `openai` nunca se había probado corriendo de verdad en el runtime
// de Cloudflare Workers (es la primera integración HTTP saliente de esta
// app), y algo en su inicialización fallaba en producción sin dejar rastro
// útil — Next.js lo mostraba como el error genérico de Server Components,
// igual con o sin try/catch alrededor. fetch() es una primitiva nativa de
// Workers (no una librería que la envuelve), así que es la superficie de
// incompatibilidad más chica posible para esta llamada.

interface MensajeOpenAI {
  role: "system" | "user" | "assistant" | "tool";
  // `null` en mensajes de assistant que solo traen tool_calls — la API lo
  // devuelve así y lo acepta de vuelta tal cual.
  content: string | null;
  tool_calls?: ToolCallOpenAI[];
  tool_call_id?: string;
}

interface ToolCallOpenAI {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface RespuestaChatCompletions {
  choices: { message: MensajeOpenAI; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

const HERRAMIENTA_GUARDAR_NOTA = {
  type: "function" as const,
  function: {
    name: "guardar_nota_memoria",
    description:
      "Guarda un hecho, preferencia o meta financiera del usuario que vale la pena recordar en futuras conversaciones (p. ej. una meta de ahorro, una preocupación recurrente, una decisión que tomó). Úsala solo cuando haya algo genuinamente nuevo y duradero, no en cada mensaje.",
    parameters: {
      type: "object",
      properties: {
        contenido: {
          type: "string",
          description:
            "El hecho a recordar, en una oración corta y en tercera persona (p. ej. 'Quiere ahorrar para un coche antes de 2027.').",
        },
      },
      required: ["contenido"],
    },
  },
};

async function llamarOpenAI(
  mensajes: MensajeOpenAI[],
  { conHerramientas }: { conHerramientas: boolean },
): Promise<RespuestaChatCompletions> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("El asesor no está configurado todavía (falta OPENAI_API_KEY en el servidor).");

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO_ASESOR,
        max_completion_tokens: MAX_TOKENS_RESPUESTA,
        reasoning_effort: ESFUERZO_RAZONAMIENTO,
        // En la última iteración permitida se llama SIN herramientas: así el
        // modelo se ve obligado a cerrar con texto en vez de pedir otra tool
        // call que ya no se va a ejecutar (eso dejaba la respuesta vacía).
        ...(conHerramientas ? { tools: [HERRAMIENTA_GUARDAR_NOTA] } : {}),
        messages: mensajes,
      }),
      signal: AbortSignal.timeout(TIMEOUT_OPENAI_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("El asesor tardó demasiado en responder. Intenta de nuevo.");
    }
    throw new Error(`No se pudo conectar con el asesor: ${textoDeError(err, "error de red")}`);
  }

  if (!response.ok) {
    let detalle = `HTTP ${response.status}`;
    try {
      const cuerpo = (await response.json()) as { error?: { message?: string } };
      if (cuerpo.error?.message) detalle = cuerpo.error.message;
    } catch {
      // El cuerpo del error no era JSON válido; nos quedamos con el status.
    }

    if (response.status === 401) throw new Error("La clave de API del asesor no es válida. Revisa OPENAI_API_KEY.");
    if (response.status === 429) throw new Error("El asesor está saturado o se agotó la cuota de OpenAI. Intenta más tarde.");
    throw new Error(`El asesor no pudo responder (${detalle}).`);
  }

  const datos = (await response.json()) as RespuestaChatCompletions;
  if (!datos.choices || datos.choices.length === 0) {
    throw new Error("El asesor devolvió una respuesta vacía. Intenta de nuevo.");
  }
  return datos;
}

async function ejecutarGuardarNotaMemoria(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<string> {
  let contenido = "";
  try {
    const parsed: unknown = JSON.parse(argumentosCrudos);
    if (typeof (parsed as { contenido?: unknown })?.contenido === "string") {
      contenido = (parsed as { contenido: string }).contenido.trim();
    }
  } catch {
    return "Error: argumentos inválidos, no se guardó nada.";
  }

  if (!contenido) return "Error: contenido vacío o inválido, no se guardó nada.";
  if (contenido.length > 500) return "Error: la nota es demasiado larga (máx. 500 caracteres), no se guardó.";

  const { error } = await supabase.from("notas_memoria_asesor").insert({ user_id: userId, contenido });
  if (error) {
    console.error("Error guardando nota de memoria:", error);
    return "Error: no se pudo guardar la nota.";
  }
  return "Nota guardada correctamente.";
}

// ─────────────────────────────────────────────
// ESCRITURA: enviar mensaje y obtener respuesta
// ─────────────────────────────────────────────

export async function enviarMensajeAsesor(
  contenidoCrudo: string,
  anioVista?: number,
  mesVista?: number,
): Promise<ResultadoMensajeAsesor> {
  try {
    return await enviarMensajeAsesorInterno(contenidoCrudo, anioVista, mesVista);
  } catch (err) {
    // Última red de seguridad: nada debe salir de aquí como excepción, o
    // Next.js lo redacta en producción y el usuario pierde el detalle real
    // (ver el comentario de ResultadoMensajeAsesor arriba).
    console.error("Error en enviarMensajeAsesor:", err);
    return { ok: false, error: textoDeError(err, "No se pudo obtener respuesta del asesor.") };
  }
}

async function enviarMensajeAsesorInterno(
  contenidoCrudo: string,
  anioVista?: number,
  mesVista?: number,
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

  // El asesor razona sobre el mes que el usuario tiene ABIERTO, no sobre el
  // mes de hoy: si está revisando julio y pregunta "¿cómo voy este mes?",
  // antes se le contestaba con las cifras de septiembre.
  const hoy = hoyEnMexico();
  const anio = anioVista ?? hoy.anio;
  const mes = mesVista ?? hoy.mes;
  const esMesEnCurso = anio === hoy.anio && mes === hoy.mes;

  // Se guarda ANTES de llamar al modelo: si la llamada a la API falla, el
  // mensaje del usuario no se pierde.
  const { error: errorInsertUsuario } = await supabase
    .from("mensajes_asesor")
    .insert({ user_id: user.id, rol: "usuario", contenido });
  if (errorInsertUsuario) return { ok: false, error: `No se pudo guardar tu mensaje: ${errorInsertUsuario.message}` };

  const [balance, presupuestos, gastosRecurrentes, tendencia, resNotas, resHistorial] = await Promise.all([
    obtenerBalanceMensual(anio, mes),
    obtenerPresupuestosConGasto(anio, mes),
    obtenerGastosRecurrentes(),
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
  });
  let mensajesConversacion: MensajeOpenAI[] = [
    { role: "system", content: systemPrompt },
    ...historial.map((m): MensajeOpenAI => ({ role: m.rol === "usuario" ? "user" : "assistant", content: m.contenido })),
  ];

  let mensajeFinal: MensajeOpenAI | null = null;
  let tokensEntrada = 0;
  let tokensSalida = 0;

  try {
    for (let intento = 0; intento < MAX_ITERACIONES_TOOL; intento++) {
      const esUltimaIteracion = intento === MAX_ITERACIONES_TOOL - 1;
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
        const textoResultado =
          llamada.function.name === "guardar_nota_memoria"
            ? await ejecutarGuardarNotaMemoria(supabase, user.id, llamada.function.arguments)
            : "Error: herramienta desconocida.";
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
    return { ok: false, error: textoDeError(err, "No se pudo conectar con el asesor.") };
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
    })
    .select("id, rol, contenido, creado_en")
    .single();

  if (errorInsertAsistente) {
    console.error("No se pudo guardar la respuesta del asesor:", errorInsertAsistente);
    // Se regresa igual al cliente: ya se generó y se pagó el costo de la
    // llamada a la API, no tiene sentido perderla por un fallo de guardado.
    return {
      ok: true,
      mensajeAsistente: {
        id: `temp-${Date.now()}`,
        rol: "asistente",
        contenido: textoRespuesta,
        creado_en: new Date().toISOString(),
      },
    };
  }

  return { ok: true, mensajeAsistente: mensajeGuardado as MensajeAsesor };
}
