"use client";

import { useState, useTransition } from "react";
import { crearCategoria, eliminarCategoria } from "@/app/dashboard/actions";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { Categoria, GrupoCategoria, TipoCategoria } from "@/lib/types";

interface Options {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  onCategoriaCreada?: (categoria: Categoria) => void;
  onCambio?: () => void;
}

export function useCategoryManager({ abierto, onCerrar, onCategoriaCreada, onCambio }: Options) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("egreso");
  const [grupo, setGrupo] = useState<GrupoCategoria>("variable");
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<Categoria | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(abierto, onCerrar);

  function manejarCrear() {
    if (!nombre.trim()) {
      setError("Ingresa un nombre para la categoría.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const creada = await crearCategoria({
          nombre,
          tipo,
          grupo: tipo === "ingreso" ? null : grupo,
        });
        setNombre("");
        onCategoriaCreada?.(creada);
        onCambio?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear categoría.");
      }
    });
  }

  function manejarEliminar(cat: Categoria) {
    // Mostrar confirmación in-modal en vez de confirm() nativo
    setCategoriaAEliminar(cat);
    setError(null);
  }

  function confirmarEliminar() {
    if (!categoriaAEliminar) return;
    const idAEliminar = categoriaAEliminar.id;
    setCategoriaAEliminar(null);

    startTransition(async () => {
      try {
        await eliminarCategoria(idAEliminar);
        onCambio?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar la categoría.");
      }
    });
  }

  return {
    nombre, setNombre, tipo, setTipo, grupo, setGrupo, categoriaAEliminar, setCategoriaAEliminar,
    isPending, error, manejarCrear, manejarEliminar, confirmarEliminar,
  };
}
