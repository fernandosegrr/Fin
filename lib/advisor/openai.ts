import { ESFUERZO_RAZONAMIENTO, MAX_TOKENS_RESPUESTA, MODELO_ASESOR, OPENAI_CHAT_COMPLETIONS_URL, TIMEOUT_OPENAI_MS } from "./config";
import { textoDeError } from "./utils";

export interface MensajeOpenAI {
  role: "system" | "user" | "assistant" | "tool";
  // `null` en mensajes de assistant que solo traen tool_calls — la API lo
  // devuelve así y lo acepta de vuelta tal cual.
  content: string | null;
  tool_calls?: ToolCallOpenAI[];
  tool_call_id?: string;
}

export interface ToolCallOpenAI {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface RespuestaChatCompletions {
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

const HERRAMIENTA_REGISTRAR_MOVIMIENTO = {
  type: "function" as const,
  function: {
    name: "registrar_movimiento",
    description:
      "Registra un ingreso o egreso real en las finanzas del usuario. Úsala cuando te pida anotar, registrar o apuntar un gasto o un cobro. Debes elegir una categoría que exista en la lista del system prompt.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["ingreso", "egreso"] },
        monto: { type: "number", description: "Monto en pesos mexicanos, mayor a 0." },
        categoria: { type: "string", description: "Nombre exacto (o muy cercano) de una categoría existente." },
        metodo_pago: { type: "string", enum: ["efectivo", "tarjeta"] },
        descripcion: { type: "string", description: "Detalle corto, opcional (ej. Pollo feliz)." },
        fecha: { type: "string", description: "YYYY-MM-DD. Si se omite, se usa hoy en México." },
        cliente: {
          type: "string",
          description: "Solo para ingresos: nombre del cliente/proyecto. Se reutiliza o se crea.",
        },
      },
      required: ["tipo", "monto", "categoria", "metodo_pago"],
    },
  },
};

export async function llamarOpenAI(
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
        ...(conHerramientas ? { tools: [HERRAMIENTA_GUARDAR_NOTA, HERRAMIENTA_REGISTRAR_MOVIMIENTO] } : {}),
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
