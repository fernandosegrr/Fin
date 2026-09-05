"use client";

import { useState, useTransition } from "react";
import { X, Plus, Trash2, Tag, Layers } from "lucide-react";
import { crearCategoria, eliminarCategoria } from "@/app/dashboard/actions";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { useEscapeKey } from "@/lib/use-escape-key";
import type { Categoria, GrupoCategoria, TipoCategoria } from "@/lib/types";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  /** Se llama con la categoría recién creada (p. ej. para seleccionarla en el modal de captura). */
  onCategoriaCreada?: (categoria: Categoria) => void;
  onCambio?: () => void;
}

export function CategoryManagerModal({ abierto, onCerrar, categorias, onCategoriaCreada, onCambio }: Props) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("egreso");
  const [grupo, setGrupo] = useState<GrupoCategoria>("variable");
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<Categoria | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(abierto, onCerrar);

  if (!abierto) return null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gestion-categorias"
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 id="titulo-gestion-categorias" className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              Gestión de Categorías
            </h2>
            <p className="text-xs text-slate-400">
              Crea o elimina categorías para tus ingresos y gastos.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Formulario para agregar */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Nueva Categoría
          </h3>

          <div>
            <input
              type="text"
              placeholder="Nombre (ej. Gimnasio, Freelance...)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl bg-slate-800/80 border border-white/10 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Tipo */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setTipo("egreso")}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                  tipo === "egreso" ? "bg-rose-600 text-white" : "text-slate-400"
                }`}
              >
                Egreso
              </button>
              <button
                type="button"
                onClick={() => setTipo("ingreso")}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                  tipo === "ingreso" ? "bg-emerald-600 text-white" : "text-slate-400"
                }`}
              >
                Ingreso
              </button>
            </div>

            {/* Grupo (solo si es Egreso) */}
            {tipo === "egreso" ? (
              <div className="flex rounded-xl bg-slate-900 p-1 border border-white/5">
                <button
                  type="button"
                  onClick={() => setGrupo("variable")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    grupo === "variable" ? "bg-amber-600 text-white" : "text-slate-400"
                  }`}
                >
                  Variable
                </button>
                <button
                  type="button"
                  onClick={() => setGrupo("fijo")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    grupo === "fijo" ? "bg-indigo-600 text-white" : "text-slate-400"
                  }`}
                >
                  Fijo
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center text-xs text-slate-500 italic">
                Sin grupo
              </div>
            )}
          </div>

          <GlowButton
            variant="primary"
            onClick={manejarCrear}
            disabled={isPending}
            className="w-full mt-2"
          >
            <Plus className="h-4 w-4" /> Agregar Categoría
          </GlowButton>
        </div>

        {/* Lista de categorías existentes */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Categorías Existentes ({categorias.length})
          </p>

          {categorias.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-white/5"
            >
              <div className="flex items-center gap-2">
                <Tag
                  className={`h-4 w-4 ${
                    c.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"
                  }`}
                />
                <span className="text-sm font-medium text-slate-200">{c.nombre}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {c.tipo} {c.grupo ? `· ${c.grupo}` : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => manejarEliminar(c)}
                disabled={isPending}
                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
                title="Eliminar categoría"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      {categoriaAEliminar && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-3xl p-6">
          <div className="w-full max-w-xs rounded-2xl border border-rose-500/30 bg-slate-900 p-5 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6 text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-100">¿Eliminar categoría?</p>
                <p className="text-xs text-slate-300 mt-1">
                  <span className="font-semibold text-rose-300">&quot;{categoriaAEliminar.nombre}&quot;</span> será eliminada.
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Los presupuestos de esta categoría se eliminan. Si tiene movimientos, no se podrá borrar: cámbialos o elimínalos primero.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-1">
                <button
                  type="button"
                  onClick={() => setCategoriaAEliminar(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-white/10 text-slate-300 hover:text-white hover:border-white/30 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminar}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/25"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
