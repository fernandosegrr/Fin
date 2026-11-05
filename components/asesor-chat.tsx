"use client";

import { Bot, Eraser, Loader2, Send, Sparkles, ArrowDown } from "lucide-react";
import { nombreDelMes } from "@/lib/dates";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { AdvisorMarkdown } from "./advisor/advisor-markdown";
import { MAX_CARACTERES, useAdvisorChat } from "./advisor/use-advisor-chat";

interface Props {
  /** Mes que el usuario tiene abierto en el dashboard: el asesor razona sobre ESE mes, no sobre el de hoy. */
  anio: number;
  mes: number;
  onDatosCambiados?: () => void;
  activo?: boolean;
}

const SUGERENCIAS = [
  "¿Cuánto puedo gastar esta semana considerando mis pagos pendientes?",
  "¿Qué gastos podría reducir según mi historial?",
  "Separa mi consumo, ahorro y rendimientos netos de este mes",
  "Anota $50 de pollo en efectivo",
];

export function AsesorChat({ anio, mes, onDatosCambiados, activo = true }: Props) {
  const {
    mensajes, cargando, errorCarga, texto, setTexto, enviando, borrando, finRef, textareaRef,
    enviarMensaje, ajustarAlturaTextarea, manejarSubmit, manejarTeclaTextarea,
    borrarConversacion, nombreMes, cercaDelLimite, reintentarCarga,
    listaRef, panelRef, alDesplazarLista, mostrarIrAlFinal, irAlFinal, hayAnteriores, cargarAnteriores, cargandoAnteriores,
    estadoRespuesta,
  } = useAdvisorChat(anio, mes, onDatosCambiados, activo);

  return (
    <div ref={panelRef} className="advisor-panel relative rounded-3xl border border-[#DCE4DB] bg-white shadow-2xl shadow-black/5 overflow-hidden flex flex-col">
      <div className="px-4 sm:px-6 py-4 border-b border-[#DCE4DB] flex items-center gap-3 bg-[#F4F7F2]">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-violet-500/20 border border-emerald-400/30 text-[#286F50] shrink-0 shadow-sm shadow-emerald-500/20">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-black text-[#1C3028] flex items-center gap-1.5">
              Asesor Financiero IA <span className="font-semibold text-[#7A897D] text-xs">· {nombreMes}</span>
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-[#286F50]">
              Con tus movimientos
            </span>
          </div>
          <p className="text-[11px] text-[#5E7165]">
            Acceso al detalle de cada compra, tablas comparativas, búsqueda histórica y registro inteligente.
          </p>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={borrarConversacion}
            disabled={enviando || borrando}
            title="Borrar conversación"
            aria-label="Borrar conversación"
            className="p-2 rounded-xl text-[#5E7165] hover:text-[#AA524A] hover:bg-rose-500/10 disabled:opacity-40 transition-colors shrink-0"
          >
            {borrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div ref={listaRef} onScroll={alDesplazarLista} role="log" aria-label="Conversación con el asesor" aria-live="polite" className="advisor-messages px-4 sm:px-6 py-5 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">
        {hayAnteriores && <button type="button" onClick={cargarAnteriores} disabled={cargandoAnteriores} className="finance-action w-full">{cargandoAnteriores ? "Cargando…" : "Ver mensajes anteriores"}</button>}
        {cargando && (
          <div className="space-y-3">
            <div className="h-14 w-2/3 rounded-2xl bg-[#E8EEE7] animate-pulse border border-[#DCE4DB]" />
            <div className="h-14 w-3/4 rounded-2xl bg-[#EFF3EE] animate-pulse ml-auto border border-[#DCE4DB]" />
          </div>
        )}

        {!cargando && errorCarga && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-center">
            <p className="text-xs text-[#AA524A] mb-2">{errorCarga}</p>
            <button
              type="button"
              onClick={reintentarCarga}
              className="text-xs font-bold text-[#AA524A] hover:text-rose-200 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && mensajes.length === 0 && !enviando && (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-[#286F50] mb-4 shadow-lg shadow-emerald-500/10">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[#1C3028] mb-2">
              Conoce cada detalle de tus compras
            </h3>
            <p className="text-xs text-[#5E7165] max-w-md mx-auto mb-5 leading-relaxed">
              Pregúntame qué compraste cualquier día, pídeme tablas comparativas, busca gastos en otros meses o anota y corrige movimientos de {nombreDelMes(anio, mes)}.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviarMensaje(s)}
                  className="rounded-full border border-[#DCE4DB] bg-[#F7F9F5] px-3.5 py-1.5 text-[11px] font-semibold text-[#475C50] hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-[#286F50] transition-all shadow-sm"
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
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  m.rol === "usuario"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium shadow-md shadow-emerald-900/30"
                    : m.esError
                      ? "bg-rose-500/10 border border-rose-500/20 text-[#AA524A]"
                      : "bg-[#F7F9F5] border border-[#DCE4DB] text-[#263D33] shadow-sm"
                }`}
              >
                {m.rol === "usuario" || m.esError ? (
                  <span className="whitespace-pre-wrap">{m.contenido}</span>
                ) : (
                  <AdvisorMarkdown content={m.contenido} />
                )}
              </div>
            </div>
          ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm bg-[#F7F9F5] border border-[#DCE4DB] text-[#5E7165]">
              <span className="flex items-center gap-2 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#286F50]" /> {estadoRespuesta || "Analizando tus datos…"}
              </span>
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {mostrarIrAlFinal && <button type="button" onClick={irAlFinal} className="absolute right-5 bottom-24 rounded-full border border-[#DCE4DB] bg-white p-2 shadow-lg text-[#286F50]" aria-label="Ir al último mensaje"><ArrowDown size={19} /></button>}

      <form onSubmit={manejarSubmit} className="shrink-0 px-4 sm:px-6 py-3.5 border-t border-[#DCE4DB] bg-[#F7F9F5] flex items-end gap-2.5">
        <div className="flex-1 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] px-4 py-2.5 focus-within:border-emerald-400/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.slice(0, MAX_CARACTERES));
              requestAnimationFrame(ajustarAlturaTextarea);
            }}
            onKeyDown={manejarTeclaTextarea}
            placeholder="Pregunta por una compra, pide una tabla o registra un gasto..."
            rows={1}
            maxLength={MAX_CARACTERES}
            readOnly={cargando || Boolean(errorCarga)}
            aria-label="Mensaje para el asesor"
            className="w-full bg-transparent text-xs sm:text-sm text-[#1C3028] placeholder:text-[#96A399] focus:outline-none resize-none"
          />
          {cercaDelLimite && (
            <p className="text-[10px] text-[#7A897D] text-right">
              {texto.length}/{MAX_CARACTERES}
            </p>
          )}
        </div>
        <GlowButton type="submit" aria-label="Enviar mensaje" variant="primary" disabled={enviando || cargando || Boolean(errorCarga) || !texto.trim()} className="!p-3 shrink-0 rounded-2xl">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </GlowButton>
      </form>
    </div>
  );
}
