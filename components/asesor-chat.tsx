"use client";

import { Bot, Eraser, Loader2, Send, Sparkles } from "lucide-react";
import { nombreDelMes } from "@/lib/dates";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { MAX_CARACTERES, useAdvisorChat } from "./advisor/use-advisor-chat";

interface Props {
  /** Mes que el usuario tiene abierto en el dashboard: el asesor razona sobre ESE mes, no sobre el de hoy. */
  anio: number;
  mes: number;
}

const SUGERENCIAS = [
  "¿Cómo voy este mes?",
  "¿En qué categoría gasto más?",
  "Anota $50 de pollo en efectivo",
];

export function AsesorChat({ anio, mes }: Props) {
  const {
    mensajes, cargando, errorCarga, texto, setTexto, enviando, borrando, finRef, textareaRef,
    enviarMensaje, ajustarAlturaTextarea, manejarSubmit, manejarTeclaTextarea,
    borrarConversacion, nombreMes, cercaDelLimite, reintentarCarga,
  } = useAdvisorChat(anio, mes);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950/90 shadow-2xl shadow-black/40 overflow-hidden flex flex-col backdrop-blur-2xl">
      <div className="px-4 sm:px-6 py-4 border-b border-white/[0.08] flex items-center gap-3 bg-white/[0.02]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-violet-500/20 border border-emerald-400/30 text-emerald-300 shrink-0 shadow-sm shadow-emerald-500/20">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm sm:text-base font-black text-slate-100 flex items-center gap-1.5">
            Asesor Financiero IA <span className="font-semibold text-slate-500 text-xs">· {nombreMes}</span>
          </h2>
          <p className="text-[11px] text-slate-400">
            Análisis inteligente y registro rápido basado en tus movimientos reales.
          </p>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={borrarConversacion}
            disabled={enviando || borrando}
            title="Borrar conversación"
            aria-label="Borrar conversación"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors shrink-0"
          >
            {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-4 overflow-y-auto min-h-72 max-h-[55dvh]">
        {cargando && (
          <div className="space-y-3">
            <div className="h-14 w-2/3 rounded-2xl bg-slate-800/40 animate-pulse border border-white/[0.05]" />
            <div className="h-14 w-3/4 rounded-2xl bg-slate-800/25 animate-pulse ml-auto border border-white/[0.05]" />
          </div>
        )}

        {!cargando && errorCarga && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-center">
            <p className="text-xs text-rose-400 mb-2">{errorCarga}</p>
            <button
              type="button"
              onClick={reintentarCarga}
              className="text-xs font-bold text-rose-300 hover:text-rose-200 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && mensajes.length === 0 && !enviando && (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 mb-4 shadow-lg shadow-emerald-500/10">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100 mb-2">
              Dale claridad a tus números
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
              Pregúntame sobre tus gastos, balance proyectado o pide que anote un gasto rápido para {nombreDelMes(anio, mes)}.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviarMensaje(s)}
                  className="rounded-full border border-white/[0.08] bg-slate-950/70 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all shadow-sm"
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
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  m.rol === "usuario"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium shadow-md shadow-emerald-900/30"
                    : m.esError
                      ? "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                      : "bg-slate-950/70 border border-white/[0.08] text-slate-200 shadow-sm"
                }`}
              >
                <span className="whitespace-pre-wrap">{m.contenido}</span>
              </div>
            </div>
          ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm bg-slate-950/70 border border-white/[0.08] text-slate-400">
              <span className="flex items-center gap-2 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> El asesor está razonando tus datos...
              </span>
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      <form onSubmit={manejarSubmit} className="px-4 sm:px-6 py-3.5 border-t border-white/[0.08] bg-slate-950/60 flex items-end gap-2.5">
        <div className="flex-1 rounded-2xl bg-slate-950/90 border border-white/[0.08] px-4 py-2.5 focus-within:border-emerald-400/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.slice(0, MAX_CARACTERES));
              requestAnimationFrame(ajustarAlturaTextarea);
            }}
            onKeyDown={manejarTeclaTextarea}
            placeholder="Pregunta algo o anota un movimiento..."
            rows={1}
            maxLength={MAX_CARACTERES}
            readOnly={enviando || cargando || Boolean(errorCarga)}
            className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none"
          />
          {cercaDelLimite && (
            <p className="text-[10px] text-slate-500 text-right">
              {texto.length}/{MAX_CARACTERES}
            </p>
          )}
        </div>
        <GlowButton type="submit" variant="primary" disabled={enviando || cargando || Boolean(errorCarga) || !texto.trim()} className="!p-3 shrink-0 rounded-2xl">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </GlowButton>
      </form>
    </div>
  );
}
