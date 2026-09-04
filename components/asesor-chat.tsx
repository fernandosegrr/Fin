"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Eraser, Loader2, Send, Sparkles } from "lucide-react";
import {
  borrarHistorialAsesor,
  enviarMensajeAsesor,
  obtenerHistorialAsesor,
} from "@/app/dashboard/asesor-actions";
import { capitalizarPrimeraLetra } from "@/lib/format";
import { nombreDelMes } from "@/lib/dates";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { MensajeAsesor } from "@/lib/types";

type MensajeUI = MensajeAsesor & { esError?: boolean };

interface Props {
  /** Mes que el usuario tiene abierto en el dashboard: el asesor razona sobre ESE mes, no sobre el de hoy. */
  anio: number;
  mes: number;
}

const MAX_CARACTERES = 4000;
const SUGERENCIAS = [
  "¿Cómo voy este mes?",
  "¿En qué categoría gasto más?",
  "Anota $50 de pollo en efectivo",
];

export function AsesorChat({ anio, mes }: Props) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const enviandoRef = useRef(false);

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

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes.length, enviando]);

  function ajustarAlturaTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function enviarMensaje(contenidoForzado?: string) {
    const contenidoEnviar = (contenidoForzado ?? texto).trim();
    if (!contenidoEnviar || enviandoRef.current) return;
    if (contenidoEnviar.length > MAX_CARACTERES) return;

    const mensajeUsuario: MensajeUI = {
      id: `local-${Date.now()}`,
      rol: "usuario",
      contenido: contenidoEnviar,
      creado_en: new Date().toISOString(),
    };

    enviandoRef.current = true;
    setTexto("");
    setEnviando(true);
    setMensajes((prev) => [...prev, mensajeUsuario]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });

    enviarMensajeAsesor(contenidoEnviar, anio, mes)
      .then((resultado) => {
        if (resultado.ok) {
          setMensajes((prev) => [...prev, resultado.mensajeAsistente]);
        } else {
          setMensajes((prev) => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              rol: "asistente",
              contenido: resultado.error,
              creado_en: new Date().toISOString(),
              esError: true,
            },
          ]);
        }
      })
      .catch((err: unknown) => {
        setMensajes((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            rol: "asistente",
            contenido: err instanceof Error ? err.message : "No se pudo obtener respuesta.",
            creado_en: new Date().toISOString(),
            esError: true,
          },
        ]);
      })
      .finally(() => {
        enviandoRef.current = false;
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

  async function borrarConversacion() {
    if (enviando || borrando) return;
    if (!confirm("¿Borrar la conversación? Las notas que el asesor recuerde de ti se conservan.")) return;
    setBorrando(true);
    const resultado = await borrarHistorialAsesor();
    setBorrando(false);
    if (resultado.ok) setMensajes([]);
    else {
      setMensajes((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          rol: "asistente",
          contenido: resultado.error,
          creado_en: new Date().toISOString(),
          esError: true,
        },
      ]);
    }
  }

  const nombreMes = capitalizarPrimeraLetra(nombreDelMes(anio, mes));
  const cercaDelLimite = texto.length > MAX_CARACTERES - 400;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden flex flex-col">
      <div className="px-4 sm:px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
          <Bot className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-100">
            Asesor IA <span className="font-medium text-slate-500">· {nombreMes}</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            No es un asesor financiero licenciado — sugerencias generales basadas en tus datos.
          </p>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={borrarConversacion}
            disabled={enviando || borrando}
            title="Borrar conversación"
            aria-label="Borrar conversación"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 shrink-0"
          >
            {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          </button>
        )}
      </div>

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

        {!cargando && !errorCarga && mensajes.length === 0 && !enviando && (
          <div className="text-center py-6">
            <Sparkles className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
              Pregúntame sobre tus finanzas — veo ingresos, gastos, presupuestos y suscripciones de {nombreDelMes(anio, mes)}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviarMensaje(s)}
                  className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!cargando &&
          !errorCarga &&
          mensajes.map((m) => (
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
                <span className="whitespace-pre-wrap">{m.contenido}</span>
              </div>
            </div>
          ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-slate-800 text-slate-400">
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> El asesor está pensando...
              </span>
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      <form onSubmit={manejarSubmit} className="px-4 sm:px-5 py-3 border-t border-white/10 flex items-end gap-2">
        <div className="flex-1 rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-2.5 focus-within:border-emerald-400/60">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.slice(0, MAX_CARACTERES));
              requestAnimationFrame(ajustarAlturaTextarea);
            }}
            onKeyDown={manejarTeclaTextarea}
            placeholder="Escribe tu mensaje..."
            rows={1}
            maxLength={MAX_CARACTERES}
            readOnly={enviando}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
          />
          {cercaDelLimite && (
            <p className="text-[10px] text-slate-500 text-right">
              {texto.length}/{MAX_CARACTERES}
            </p>
          )}
        </div>
        <GlowButton type="submit" variant="primary" disabled={enviando || !texto.trim()} className="!p-2.5 shrink-0">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </GlowButton>
      </form>
    </div>
  );
}
