"use client";

import { useEffect, useRef, useState } from "react";
import { borrarHistorialAsesor, obtenerHistorialAsesor } from "@/app/dashboard/asesor-actions";
import { consultarAsesor } from "@/lib/advisor/transport";
import { capitalizarPrimeraLetra } from "@/lib/format";
import { nombreDelMes } from "@/lib/dates";
import type { MensajeAsesor } from "@/lib/types";

type MensajeUI = MensajeAsesor & { esError?: boolean };
export const MAX_CARACTERES = 4000;

export function useAdvisorChat(anio: number, mes: number, onDatosCambiados?: () => void, activo = true) {
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estadoRespuesta, setEstadoRespuesta] = useState("");
  const [borrando, setBorrando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const alFinalRef = useRef(true);
  const [mostrarIrAlFinal, setMostrarIrAlFinal] = useState(false);
  const [cargandoAnteriores, setCargandoAnteriores] = useState(false);
  const [hayAnteriores, setHayAnteriores] = useState(false);
  const cursorRef = useRef<{ creado_en: string; id: string } | null>(null);
  const solicitudRef = useRef<{ texto: string; id: string } | null>(null);
  const enviandoRef = useRef(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setErrorCarga(null);
    obtenerHistorialAsesor()
      .then((resultado) => {
        if (cancelado) return;
        if (resultado.ok) {
          setMensajes(resultado.mensajes);
          setHayAnteriores(Boolean(resultado.hayMas));
          cursorRef.current = resultado.cursorAnterior ?? null;
          alFinalRef.current = true;
        }
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
    if (!activo || !alFinalRef.current || cargandoAnteriores) return;
    const id = requestAnimationFrame(() => {
      const el = listaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [mensajes.length, enviando, activo, cargandoAnteriores]);

  useEffect(() => {
    if (!activo) return;
    document.documentElement.classList.add("advisor-open");
    window.scrollTo({ top: 0 });
    const viewport = window.visualViewport;
    function ajustarViewport() {
      const el = panelRef.current; if (!el) return;
      const teclado = Boolean(viewport && viewport.height < window.innerHeight * .78);
      document.documentElement.classList.toggle("advisor-keyboard-open", teclado);
      const alto = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--advisor-viewport-height", `${alto}px`);
      const top = el.getBoundingClientRect().top - (viewport?.offsetTop ?? 0);
      const nav = !teclado && window.innerWidth < 1024 ? 86 : 20;
      el.style.maxHeight = `${Math.max(180, alto - Math.max(0, top) - nav)}px`;
    }
    ajustarViewport();
    viewport?.addEventListener("resize", ajustarViewport);
    window.addEventListener("resize", ajustarViewport);
    return () => {
      viewport?.removeEventListener("resize", ajustarViewport);
      window.removeEventListener("resize", ajustarViewport);
      document.documentElement.classList.remove("advisor-keyboard-open");
      document.documentElement.classList.remove("advisor-open");
      document.documentElement.style.removeProperty("--advisor-viewport-height");
    };
  }, [activo]);

  function alDesplazarLista() {
    const el = listaRef.current; if (!el) return;
    alFinalRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 80;
    setMostrarIrAlFinal(!alFinalRef.current);
  }

  function irAlFinal() {
    alFinalRef.current = true; setMostrarIrAlFinal(false);
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }

  async function cargarAnteriores() {
    if (cargandoAnteriores || !cursorRef.current) return;
    const altoAnterior = listaRef.current?.scrollHeight ?? 0;
    const posicionAnterior = listaRef.current?.scrollTop ?? 0;
    alFinalRef.current = false; setCargandoAnteriores(true);
    try {
      const r = await obtenerHistorialAsesor(cursorRef.current);
      if (!r.ok) throw new Error(r.error);
      cursorRef.current = r.cursorAnterior ?? null; setHayAnteriores(Boolean(r.hayMas));
      setMensajes(prev => [...r.mensajes.filter(m => !prev.some(p => p.id === m.id)), ...prev]);
      requestAnimationFrame(() => { const el = listaRef.current; if (el) el.scrollTop = posicionAnterior + el.scrollHeight - altoAnterior; });
    } catch (e) { agregarError(e instanceof Error ? e.message : "No se pudo cargar el historial anterior."); }
    finally { setCargandoAnteriores(false); }
  }

  function ajustarAlturaTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function agregarError(mensaje: string) {
    setMensajes((prev) => [
      ...prev,
      {
        id: `error-${Date.now()}`,
        rol: "asistente",
        contenido: mensaje,
        creado_en: new Date().toISOString(),
        esError: true,
      },
    ]);
  }

  function enviarMensaje(contenidoForzado?: string) {
    const contenidoEnviar = (contenidoForzado ?? texto).trim();
    if (!contenidoEnviar || cargando || errorCarga || enviandoRef.current) return;
    if (contenidoEnviar.length > MAX_CARACTERES) return;

    const mensajeUsuario: MensajeUI = {
      id: `local-${Date.now()}`,
      rol: "usuario",
      contenido: contenidoEnviar,
      creado_en: new Date().toISOString(),
    };

    enviandoRef.current = true;
    alFinalRef.current = true;
    if (!solicitudRef.current || solicitudRef.current.texto !== contenidoEnviar) solicitudRef.current = { texto: contenidoEnviar, id: crypto.randomUUID() };
    setTexto("");
    setEnviando(true);
    setEstadoRespuesta("Consultando tus movimientos…");
    setMensajes((prev) => [...prev, mensajeUsuario]);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });

    consultarAsesor(contenidoEnviar, anio, mes, solicitudRef.current.id, setEstadoRespuesta)
      .then((resultado) => {
        if (resultado.ok) {
          solicitudRef.current = null;
          setMensajes((prev) => [...prev, resultado.mensajeAsistente]);
          if (resultado.datosModificados) {
            onDatosCambiados?.();
          }
        } else {
          agregarError(resultado.error);
          if (resultado.datosModificados) onDatosCambiados?.();
          else setTexto(prev => prev || contenidoEnviar);
        }
      })
      .catch((err: unknown) => {
        agregarError(err instanceof Error ? err.message : "No se pudo obtener respuesta.");
        setTexto(prev => prev || contenidoEnviar);
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
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviarMensaje();
    }
  }

  async function borrarConversacion() {
    if (enviando || borrando) return;
    if (!confirm("¿Borrar la conversación? Las notas que el asesor recuerde de ti se conservan.")) return;
    setBorrando(true);
    try {
      const resultado = await borrarHistorialAsesor();
      if (resultado.ok) { setMensajes([]); setHayAnteriores(false); cursorRef.current = null; solicitudRef.current = null; }
      else agregarError(resultado.error);
    } catch (err) {
      agregarError(err instanceof Error ? err.message : "No se pudo borrar la conversación.");
    } finally {
      setBorrando(false);
    }
  }

  const nombreMes = capitalizarPrimeraLetra(nombreDelMes(anio, mes));
  const cercaDelLimite = texto.length > MAX_CARACTERES - 400;

  return {
    mensajes, cargando, errorCarga, texto, setTexto, enviando, borrando, finRef, textareaRef,
    listaRef, panelRef, alDesplazarLista, mostrarIrAlFinal, irAlFinal, hayAnteriores, cargarAnteriores, cargandoAnteriores,
    estadoRespuesta,
    enviarMensaje, ajustarAlturaTextarea, manejarSubmit, manejarTeclaTextarea,
    borrarConversacion, nombreMes, cercaDelLimite, reintentarCarga: () => setIntentoCarga((n) => n + 1),
  };
}
