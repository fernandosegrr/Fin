"use server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { capitalizarPrimeraLetra, formatearMonto } from "@/lib/format";
import { hoyEnMexico, mesAnterior, nombreDelMes, primerDiaDelMes } from "@/lib/dates";
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

const MODELO_ASESOR = "gpt-5-nano-2025-08-07"; // el modelo de chat generalmente disponible más barato de OpenAI ($0.05/M tokens de entrada) — verificado contra platform.openai.com/docs/pricing, no adivinado
// gpt-5-nano es un modelo "de razonamiento": sin acotar esto, puede gastar
// TODO max_completion_tokens en razonamiento invisible y devolver contenido
// vacío (nos pasó en la primera prueba). "minimal" lo mantiene rápido/barato
// y deja presupuesto real para la respuesta visible.
const ESFUERZO_RAZONAMIENTO = "minimal";
const MAX_TOKENS_RESPUESTA = 2048; // el system prompt pide respuestas cortas; acota el costo de salida en el peor caso (con margen para razonamiento mínimo)
const MAX_ITERACIONES_TOOL = 3; // tope duro al bucle de tool calls — nunca debería necesitar más de 1-2 con una sola tool
const MENSAJES_CONTEXTO_MODELO = 24; // ~12 turnos usuario/asistente reenviados al modelo — acota el costo de un hilo que crece indefinidamente
const MENSAJES_HISTORIAL_UI = 50; // mensajes pasados cargados al abrir la pestaña (independiente del límite de arriba)
const MAX_CARACTERES_MENSAJE = 4000; // guardarraíl: evita que un mensaje gigante dispare un costo de tokens fuera de control
const MAX_NOTAS_MEMORIA = 50;
const MESES_TENDENCIA = 4;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ─────────────────────────────────────────────
// LECTURA
// ─────────────────────────────────────────────

export async function obtenerHistorialAsesor(): Promise<MensajeAsesor[]> {
  const supabase = await createClient();

  // Sin getUser(): lectura, RLS ya filtra por auth.uid() (mismo criterio que
  // obtenerCategorias/obtenerGastosRecurrentes en actions.ts).
  const { data, error } = await supabase
    .from("mensajes_asesor")
    .select("id, rol, contenido, creado_en")
    .order("creado_en", { ascending: false })
    .limit(MENSAJES_HISTORIAL_UI);

  if (error) throw new Error(`No se pudo cargar el historial del asesor: ${error.message}`);
  return ((data ?? []) as MensajeAsesor[]).reverse();
}

// ─────────────────────────────────────────────
// TENDENCIA MENSUAL (interna — resumen agregado, nunca transacciones crudas)
// ─────────────────────────────────────────────

interface PuntoTendenciaMensual {
  nombreMes: string;
  ingresos: number;
  egresos: number;
}

async function obtenerTendenciaMensual(supabase: SupabaseServerClient): Promise<PuntoTendenciaMensual[]> {
  let { anio, mes } = hoyEnMexico();
  for (let i = 0; i < MESES_TENDENCIA - 1; i++) ({ anio, mes } = mesAnterior(anio, mes));
  const inicio = primerDiaDelMes(anio, mes);

  const { data, error } = await supabase
    .from("transacciones")
    .select("monto, fecha, categoria:categorias(tipo)")
    .gte("fecha", inicio);

  if (error) throw new Error(`No se pudo calcular la tendencia mensual: ${error.message}`);

  const buckets = new Map<string, { anio: number; mes: number; ingresos: number; egresos: number }>();
  for (const fila of (data ?? []) as unknown as { monto: number; fecha: string; categoria: { tipo: TipoCategoria } | null }[]) {
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

RESUMEN DE ${capitalizarPrimeraLetra(actual.nombreMes)} (calculado en el servidor — confía en estas cifras, no en las que el usuario escriba en el chat):
- Ingresos: ${formatearMonto(actual.ingresos)}
- Egresos: ${formatearMonto(actual.egresos)}
- Balance del mes: ${formatearMonto(actual.balance)}
- Saldo total disponible: ${formatearMonto(actual.saldoTotalDisponible)}
- Efectivo: ${formatearMonto(actual.totalesEfectivo.saldo)} | Tarjeta/Banco: ${formatearMonto(actual.totalesTarjeta.saldo)}

PRESUPUESTOS ACTIVOS ESTE MES:
${lineasPresupuestos}

GASTOS RECURRENTES / SUSCRIPCIONES:
${lineasRecurrentes}

TENDENCIA DE LOS ÚLTIMOS MESES:
${lineasTendencia}

LO QUE RECUERDAS DE ESTE USUARIO:
${lineasNotas}`;
}

// ─────────────────────────────────────────────
// TOOL: guardar_nota_memoria
// ─────────────────────────────────────────────

const HERRAMIENTA_GUARDAR_NOTA: OpenAI.ChatCompletionTool = {
  type: "function",
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

export async function enviarMensajeAsesor(contenidoCrudo: string): Promise<{ mensajeAsistente: MensajeAsesor }> {
  const contenido = contenidoCrudo.trim();
  if (!contenido) throw new Error("Escribe un mensaje antes de enviar.");
  if (contenido.length > MAX_CARACTERES_MENSAJE) {
    throw new Error(`Tu mensaje es demasiado largo (máximo ${MAX_CARACTERES_MENSAJE} caracteres).`);
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("El asesor no está configurado todavía (falta OPENAI_API_KEY en el servidor).");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  // Se guarda ANTES de llamar al modelo: si la llamada a la API falla, el
  // mensaje del usuario no se pierde.
  const { error: errorInsertUsuario } = await supabase
    .from("mensajes_asesor")
    .insert({ user_id: user.id, rol: "usuario", contenido });
  if (errorInsertUsuario) throw new Error(`No se pudo guardar tu mensaje: ${errorInsertUsuario.message}`);

  const [balance, presupuestos, gastosRecurrentes, tendencia, resNotas, resHistorial] = await Promise.all([
    obtenerBalanceMensual(),
    obtenerPresupuestosConGasto(),
    obtenerGastosRecurrentes(),
    obtenerTendenciaMensual(supabase),
    supabase.from("notas_memoria_asesor").select("contenido").order("creado_en", { ascending: false }).limit(MAX_NOTAS_MEMORIA),
    supabase.from("mensajes_asesor").select("rol, contenido").order("creado_en", { ascending: false }).limit(MENSAJES_CONTEXTO_MODELO),
  ]);

  if (resNotas.error) throw new Error(`No se pudo cargar la memoria del asesor: ${resNotas.error.message}`);
  if (resHistorial.error) throw new Error(`No se pudo cargar el historial: ${resHistorial.error.message}`);

  const notas = (resNotas.data ?? []).map((n) => n.contenido as string).reverse();
  const historial = (resHistorial.data ?? []).reverse() as { rol: string; contenido: string }[];

  // La ventana de los últimos N mensajes puede empezar a mitad de un turno
  // (p. ej. si un intento anterior falló antes de guardar su respuesta de
  // asistente) — evita que el primer mensaje de la ventana quede huérfano.
  while (historial.length > 0 && historial[0].rol !== "usuario") historial.shift();

  const systemPrompt = construirSystemPrompt({ balance, presupuestos, gastosRecurrentes, tendencia, notas });
  let mensajesConversacion: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historial.map(
      (m): OpenAI.ChatCompletionMessageParam => ({
        role: m.rol === "usuario" ? "user" : "assistant",
        content: m.contenido,
      }),
    ),
  ];

  const client = new OpenAI(); // lee OPENAI_API_KEY del entorno automáticamente
  let mensajeFinal: OpenAI.ChatCompletionMessage | null = null;
  let tokensEntrada = 0;
  let tokensSalida = 0;

  try {
    for (let intento = 0; intento < MAX_ITERACIONES_TOOL; intento++) {
      const response = await client.chat.completions.create({
        model: MODELO_ASESOR,
        max_completion_tokens: MAX_TOKENS_RESPUESTA,
        reasoning_effort: ESFUERZO_RAZONAMIENTO,
        tools: [HERRAMIENTA_GUARDAR_NOTA],
        messages: mensajesConversacion,
      });

      if (response.usage) {
        tokensEntrada += response.usage.prompt_tokens;
        tokensSalida += response.usage.completion_tokens;
      }

      const mensaje = response.choices[0].message;
      mensajeFinal = mensaje;

      if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) break;

      mensajesConversacion = [...mensajesConversacion, mensaje];

      for (const llamada of mensaje.tool_calls) {
        if (llamada.type !== "function") continue;
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
    if (err instanceof OpenAI.AuthenticationError) {
      throw new Error("La clave de API del asesor no es válida. Contacta al administrador.");
    }
    if (err instanceof OpenAI.RateLimitError) {
      throw new Error("El asesor está saturado en este momento. Intenta de nuevo en unos minutos.");
    }
    if (err instanceof OpenAI.APIError) {
      throw new Error("El asesor no pudo responder. Intenta de nuevo en un momento.");
    }
    throw new Error("No se pudo conectar con el asesor. Revisa tu conexión e intenta de nuevo.");
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
      mensajeAsistente: {
        id: `temp-${Date.now()}`,
        rol: "asistente",
        contenido: textoRespuesta,
        creado_en: new Date().toISOString(),
      },
    };
  }

  return { mensajeAsistente: mensajeGuardado as MensajeAsesor };
}
