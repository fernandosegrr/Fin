
export const MODELO_ASESOR = "gpt-6-luna";
// OJO: esta familia YA NO acepta "minimal" (la API responde 400: «does not
// support 'minimal' with this model. Supported values are: 'none', 'low',
// 'medium', 'high', 'xhigh'»). "none" es el equivalente: verificado contra la
// API real, devuelve reasoning_tokens = 0 y aun así llama correctamente a
// las tools del asesor. Sin acotar esto, un modelo de razonamiento puede
// gastar TODO max_completion_tokens en razonamiento invisible y devolver
// contenido vacío.
export const ESFUERZO_RAZONAMIENTO = "none";
export const MAX_TOKENS_RESPUESTA = 4096; // margen amplio para tablas Markdown, desgloses de compras y análisis detallado
export const MAX_ITERACIONES_TOOL = 5; // permite encadenar consultas de detalle + acciones y cerrar con respuesta completa
export const MAX_TRANSACCIONES_PROMPT = 100; // compras/movimientos individuales del mes inyectados directamente en el system prompt
export const MENSAJES_CONTEXTO_MODELO = 24; // ~12 turnos usuario/asistente reenviados al modelo — acota el costo de un hilo que crece indefinidamente
export const MENSAJES_HISTORIAL_UI = 50; // mensajes pasados cargados al abrir la pestaña (independiente del límite de arriba)
export const MAX_CARACTERES_MENSAJE = 4000; // guardarraíl: evita que un mensaje gigante dispare un costo de tokens fuera de control
export const MAX_NOTAS_MEMORIA = 50;
export const MESES_TENDENCIA = 4;
export const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
// Sin timeout, una petición colgada a OpenAI se lleva TODO el presupuesto de
// tiempo de la función serverless y el usuario acaba viendo el error genérico
// de la plataforma en vez de algo accionable. 45 s deja margen de sobra para
// gpt-6-luna con reasoning "none".
export const TIMEOUT_OPENAI_MS = 45_000;
export const COOLDOWN_MENSAJE_MS = 2_500;
export const MAX_MENSAJES_POR_HORA = 20;
