"use client";

import { startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { enviarMensajeAsesor, obtenerHistorialAsesor } from "@/app/dashboard/asesor-actions";
import { capitalizarPrimeraLetra } from "@/lib/format";
import { nombreDelMes } from "@/lib/dates";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { MensajeAsesor } from "@/lib/types";

type MensajeUI = MensajeAsesor & { pendiente?: boolean; esError?: boolean };

interface Props {
  /** Mes que el usuario tiene abierto en el dashboard: el asesor razona sobre ESE mes, no sobre el de hoy. */
  anio: number;
  mes: number;
}

export function AsesorChat({ anio, mes }: Props) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  const [mensajesOptimistas, agregarMensajeOptimista] = useOptimistic<MensajeUI[], MensajeUI>(
    mensajes,
    (estado, nuevo) => [...estado, nuevo],
  );

  // Salvaguarda: en la ventana entre que setMensajes() confirma un mensaje
  // real y React termina de descartar la acción optimista que lo adelantó,
  // useOptimistic puede mostrar momentáneamente ambas copias con el mismo id
  // (mismo objeto mensajeUsuario, agregado una vez vía optimista y otra vez
  // vía setMensajes). Se filtra aquí para que ese instante transitorio nunca
  // llegue a renderizar keys duplicadas, sin depender de ajustar el timing.
  const mensajesUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return mensajesOptimistas.filter((m) => {
      if (vistos.has(m.id)) return false;
      vistos.add(m.id);
      return true;
    });
  }, [mensajesOptimistas]);

  // Carga perezosa: este efecto solo corre cuando AsesorChat se monta, es
  // decir, la primera vez que el usuario abre la pestaña "Asesor" — no como
  // parte del Promise.all inicial del dashboard.
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setErrorCarga(null);
    obtenerHistorialAsesor()
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.ok) setMensajes(resultado.mensajes);
        else setErrorCarga(resultado.error);
      })
      .catch((err) => {
        if (!cancelado) setErrorCarga(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [intentoCarga]);

  // `block: "nearest"` desplaza solo el contenedor del chat lo mínimo
  // necesario. Sin eso, scrollIntoView() arrastra TODA la página hasta el
  // final del chat cada vez que se carga el historial o llega un mensaje.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajesUnicos.length]);

  function enviarMensaje() {
    const contenidoEnviar = texto.trim();
    if (!contenidoEnviar || enviando) return;

    const mensajeUsuario: MensajeUI = {
      id: `local-${Date.now()}`,
      rol: "usuario",
      contenido: contenidoEnviar,
      creado_en: new Date().toISOString(),
    };
    setTexto("");
    setEnviando(true);

    // La transición envuelve SOLO el despacho optimista (síncrono) y se
    // resuelve de inmediato. Si en cambio envolviera también el await de más
    // abajo, seguiría "activa" mientras se espera la respuesta — y al llegar,
    // setMensajes() podría comitear junto con un replay de estas mismas
    // acciones optimistas todavía pendientes, duplicando mensajeUsuario en el
    // array (React se queja de keys duplicadas). Separado así, para cuando
    // enviarMensajeAsesor() resuelve, esta transición ya asentó por completo.
    startTransition(() => {
      agregarMensajeOptimista(mensajeUsuario);
      agregarMensajeOptimista({ id: "pensando", rol: "asistente", contenido: "", creado_en: "", pendiente: true });
    });

    // El mensaje del usuario ya se guardó en la BD (la Server Action lo
    // inserta antes de llamar al modelo) — en caso de error se conserva en la
    // lista junto con un mensaje de error local (no persiste) para reintentar.
    const mostrarError = (texto: string) =>
      setMensajes((prev) => [
        ...prev,
        mensajeUsuario,
        {
          id: `error-${Date.now()}`,
          rol: "asistente",
          contenido: texto,
          creado_en: new Date().toISOString(),
          esError: true,
        },
      ]);

    enviarMensajeAsesor(contenidoEnviar, anio, mes)
      .then((resultado) => {
        if (resultado.ok) setMensajes((prev) => [...prev, mensajeUsuario, resultado.mensajeAsistente]);
        else mostrarError(resultado.error);
      })
      .catch((err: unknown) => {
        mostrarError(err instanceof Error ? err.message : "No se pudo obtener respuesta.");
      })
      .finally(() => {
        setEnviando(false);
      });
  }

  function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    enviarMensaje();
  }

  function manejarTeclaTextarea(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
          <Bot className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-100">
            Asesor IA{" "}
            <span className="font-medium text-slate-500">· {capitalizarPrimeraLetra(nombreDelMes(anio, mes))}</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            No es un asesor financiero licenciado — sugerencias generales basadas en tus datos.
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="px-4 sm:px-5 py-4 space-y-3 overflow-y-auto max-h-[55dvh]">
        {cargando && (
          <div className="space-y-2">
            <div className="h-14 w-2/3 rounded-2xl bg-slate-800/60 animate-pulse" />
            <div className="h-14 w-3/4 rounded-2xl bg-slate-800/40 animate-pulse ml-auto" />
          </div>
        )}

        {!cargando && errorCarga && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-center">
            <p className="text-xs text-rose-400 mb-2">{errorCarga}</p>
            <button
              type="button"
              onClick={() => setIntentoCarga((n) => n + 1)}
              className="text-xs font-semibold text-rose-300 hover:text-rose-200 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && mensajesUnicos.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Cuéntame sobre tu situación financiera o pregúntame algo — puedo ver tus ingresos, gastos, presupuestos y
              suscripciones de {nombreDelMes(anio, mes)}.
            </p>
          </div>
        )}

        {!cargando &&
          !errorCarga &&
          mensajesUnicos.map((m) => (
            <div key={m.id} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.rol === "usuario"
                    ? "bg-emerald-600 text-white"
                    : m.esError
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                      : "bg-slate-800 text-slate-200"
                }`}
              >
                {m.pendiente ? (
                  <span className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> El asesor está pensando...
                  </span>
                ) : (
                  <span className="whitespace-pre-wrap">{m.contenido}</span>
                )}
              </div>
            </div>
          ))}

        <div ref={finRef} />
      </div>

      {/* Input */}
      <form onSubmit={manejarSubmit} className="px-4 sm:px-5 py-3 border-t border-white/10 flex items-end gap-2">
        <div className="flex-1 rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-emerald-400/60">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={manejarTeclaTextarea}
            placeholder="Escribe tu mensaje..."
            rows={1}
            // readOnly en vez de disabled: `disabled` quita el foco del
            // textarea y en móvil eso cierra el teclado en cada envío.
            readOnly={enviando}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
          />
        </div>
        <GlowButton type="submit" variant="primary" disabled={enviando || !texto.trim()} className="!p-2.5 shrink-0">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </GlowButton>
      </form>
    </div>
  );
}
