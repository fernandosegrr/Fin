"use client";

import { useEffect, useRef, useState } from "react";
import { borrarHistorialAsesor, enviarMensajeAsesor, obtenerHistorialAsesor } from "@/app/dashboard/asesor-actions";
import { capitalizarPrimeraLetra } from "@/lib/format";
import { nombreDelMes } from "@/lib/dates";
import type { MensajeAsesor } from "@/lib/types";

type MensajeUI = MensajeAsesor & { esError?: boolean };
export const MAX_CARACTERES = 4000;

export function useAdvisorChat(anio: number, mes: number, onDatosCambiados?: () => void) {
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
          if (resultado.datosModificados) {
            onDatosCambiados?.();
          }
        } else {
          agregarError(resultado.error);
        }
      })
      .catch((err: unknown) => {
        agregarError(err instanceof Error ? err.message : "No se pudo obtener respuesta.");
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
    try {
      const resultado = await borrarHistorialAsesor();
      if (resultado.ok) setMensajes([]);
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
    enviarMensaje, ajustarAlturaTextarea, manejarSubmit, manejarTeclaTextarea,
    borrarConversacion, nombreMes, cercaDelLimite, reintentarCarga: () => setIntentoCarga((n) => n + 1),
  };
}
