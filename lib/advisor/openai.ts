import { ESFUERZO_RAZONAMIENTO, MAX_TOKENS_RESPUESTA, MODELO_ASESOR, OPENAI_CHAT_COMPLETIONS_URL, TIMEOUT_OPENAI_MS } from "./config";
import { textoDeError } from "./utils";
import { HERRAMIENTAS_FINANCIERAS } from "./finance-tools";
import { NATURALEZAS } from "@/lib/finance/types";

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
        cuenta: { type: "string", description: "Nombre o código exacto de la cuenta del usuario." },
        naturaleza: { type: "string", enum: [...NATURALEZAS], description: "Efecto económico. Para traspasos y rendimientos usa sus herramientas específicas." },
        etiquetas: { type: "array", items: { type: "string" } },
        prestamo_id: { type: "string", description: "Al pagar una deuda registrada, ID del préstamo obtenido del resumen o una consulta. Omitir para deudas anteriores sin registro." },
        monto: { type: "number", description: "Monto en pesos mexicanos, mayor a 0." },
        categoria: { type: "string", description: "Nombre exacto (o muy cercano) de una categoría existente." },
        metodo_pago: { type: "string", enum: ["efectivo", "tarjeta"] },
        descripcion: { type: "string", description: "Detalle corto del gasto o compra (ej. Pollo feliz, Uber centro)." },
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

const HERRAMIENTA_CONSULTAR_MOVIMIENTOS = {
  type: "function" as const,
  function: {
    name: "consultar_movimientos",
    description:
      "Busca y filtra el detalle de compras, gastos e ingresos en toda la base de datos del usuario (cualquier mes, rango de fechas, comercio/descripción, categoría o método de pago). Devuelve cada movimiento con su fecha, monto, categoría, método, descripción, cliente e ID, además de la suma total.",
    parameters: {
      type: "object",
      properties: {
        busqueda: {
          type: "string",
          description: "Texto a buscar en la descripción/concepto, categoría o cliente (ej. 'pollo', 'uber', 'super').",
        },
        tipo: { type: "string", enum: ["todos", "ingreso", "egreso"] },
        metodo_pago: { type: "string", enum: ["todos", "efectivo", "tarjeta"] },
        categoria: { type: "string", description: "Filtrar por nombre de categoría." },
        fecha_inicio: { type: "string", description: "Fecha inicial YYYY-MM-DD (inclusive)." },
        fecha_fin: { type: "string", description: "Fecha final YYYY-MM-DD (inclusive)." },
        orden: {
          type: "string",
          enum: ["recientes", "mayor_monto"],
          description: "Ordenar por más recientes (default) o de mayor a menor monto.",
        },
        limite: { type: "number", description: "Máximo de movimientos a devolver (1 a 50, por defecto 25)." },
        offset: { type: "number", description: "Desplazamiento para leer otra página; los totales siempre incluyen todos los resultados." },
        naturaleza: { type: "string", description: "ingreso, egreso, apoyo, rendimiento, reembolso, financiacion, pago_deuda, traspaso, retencion, ajuste_entrada, ajuste_salida, ingreso_pendiente o egreso_pendiente." },
        cuenta: { type: "string", description: "Nombre de una cuenta propia para consultar solo su actividad." },
      },
    },
  },
};

const HERRAMIENTA_EDITAR_MOVIMIENTO = {
  type: "function" as const,
  function: {
    name: "editar_movimiento",
    description:
      "Modifica un movimiento (compra, gasto o ingreso) existente usando su id. Solo envía los campos que el usuario pidió cambiar; los demás se conservan.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID del movimiento a editar (aparece como id:... en el detalle)." },
        cuenta: { type: "string", description: "Cuenta a la que pertenece el movimiento." },
        naturaleza: { type: "string", enum: [...NATURALEZAS] },
        etiquetas: { type: "array", items: { type: "string" } },
        requiere_revision: { type: "boolean" },
        motivo_revision: { type: "string" },
        monto: { type: "number", description: "Nuevo monto en pesos mexicanos, mayor a 0." },
        categoria: { type: "string", description: "Nuevo nombre de categoría existente." },
        metodo_pago: { type: "string", enum: ["efectivo", "tarjeta"] },
        descripcion: { type: "string", description: "Nueva descripción o detalle de la compra." },
        fecha: { type: "string", description: "Nueva fecha YYYY-MM-DD." },
      },
      required: ["id"],
    },
  },
};

const HERRAMIENTA_ELIMINAR_MOVIMIENTO = {
  type: "function" as const,
  function: {
    name: "eliminar_movimiento",
    description:
      "Elimina un movimiento (compra, gasto o ingreso) existente usando su id cuando el usuario pida borrarlo o quitarlo.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID del movimiento a eliminar (aparece como id:... en el detalle)." },
      },
      required: ["id"],
    },
  },
};

const HERRAMIENTAS_ASESOR = [
  HERRAMIENTA_GUARDAR_NOTA,
  HERRAMIENTA_REGISTRAR_MOVIMIENTO,
  HERRAMIENTA_CONSULTAR_MOVIMIENTOS,
  HERRAMIENTA_EDITAR_MOVIMIENTO,
  HERRAMIENTA_ELIMINAR_MOVIMIENTO,
  ...HERRAMIENTAS_FINANCIERAS,
];

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
        ...(conHerramientas ? { tools: HERRAMIENTAS_ASESOR, parallel_tool_calls: false } : {}),
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
