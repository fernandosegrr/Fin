"use client";

import { X, Plus, Trash2, Tag, Layers } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import type { Categoria } from "@/lib/types";
import { useCategoryManager } from "./categories/use-category-manager";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  categorias: Categoria[];
  /** Se llama con la categoría recién creada (p. ej. para seleccionarla en el modal de captura). */
  onCategoriaCreada?: (categoria: Categoria) => void;
  onCambio?: () => void;
}

export function CategoryManagerModal(props: Props) {
  const { abierto, onCerrar, categorias } = props;
  const {
    nombre, setNombre, tipo, setTipo, grupo, setGrupo, categoriaAEliminar, setCategoriaAEliminar,
    isPending, error, manejarCrear, manejarEliminar, confirmarEliminar,
  } = useCategoryManager(props);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14251D]/45 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-gestion-categorias"
          className="w-full max-w-lg rounded-3xl border border-[#DCE4DB] bg-white p-6 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#DCE4DB]">
            <div>
              <h2 id="titulo-gestion-categorias" className="text-base sm:text-lg font-black text-[#1C3028] flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#62688B]" />
                Gestión de Categorías
              </h2>
              <p className="text-xs text-[#5E7165] mt-0.5">
                Crea o elimina categorías para clasificar tus ingresos y gastos.
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-[#5E7165] hover:bg-[#F4F7F2] hover:text-[#1C3028] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div role="alert" className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-[#AA524A]">
              {error}
            </div>
          )}

          {/* Formulario para agregar */}
          <div className="mt-4 p-4 rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#5E7165]">
              Nueva Categoría
            </h3>

            <div>
              <input
                type="text"
                aria-label="Nombre de la categoría"
                placeholder="Nombre (ej. Gimnasio, Freelance...)"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-2xl bg-[#F7F9F5] border border-[#DCE4DB] px-4 py-2.5 text-xs sm:text-sm text-[#1C3028] placeholder:text-[#96A399] focus:border-indigo-400/60 focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Tipo */}
              <div className="flex rounded-xl bg-[#F7F9F5] p-1 border border-[#DCE4DB]">
                <button
                  type="button"
                  onClick={() => setTipo("egreso")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tipo === "egreso" ? "bg-rose-500/20 text-[#AA524A] border border-rose-500/30" : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Egreso
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("ingreso")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tipo === "ingreso" ? "bg-emerald-500/20 text-[#286F50] border border-emerald-500/30" : "text-[#5E7165] hover:text-[#1C3028]"
                  }`}
                >
                  Ingreso
                </button>
              </div>

            {/* Grupo (solo si es Egreso) */}
            {tipo === "egreso" ? (
              <div className="flex rounded-xl bg-white p-1 border border-[#DCE4DB]">
                <button
                  type="button"
                  onClick={() => setGrupo("variable")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    grupo === "variable" ? "bg-amber-600 text-white" : "text-[#5E7165]"
                  }`}
                >
                  Variable
                </button>
                <button
                  type="button"
                  onClick={() => setGrupo("fijo")}
                  className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                    grupo === "fijo" ? "bg-indigo-600 text-white" : "text-[#5E7165]"
                  }`}
                >
                  Fijo
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center text-xs text-[#7A897D] italic">
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
          <p className="text-xs font-bold uppercase tracking-wider text-[#5E7165] mb-2">
            Categorías Existentes ({categorias.length})
          </p>

          {categorias.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[#F7F9F5] border border-[#DCE4DB]"
            >
              <div className="flex items-center gap-2">
                <Tag
                  className={`h-4 w-4 ${
                    c.tipo === "ingreso" ? "text-[#286F50]" : "text-[#AA524A]"
                  }`}
                />
                <span className="text-sm font-medium text-[#263D33]">{c.nombre}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8EEE7] text-[#5E7165] font-mono">
                  {c.tipo} {c.grupo ? `· ${c.grupo}` : ""}
                </span>
              </div>

              <button
                type="button"
                onClick={() => manejarEliminar(c)}
                disabled={isPending}
                className="text-[#7A897D] hover:text-[#AA524A] p-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
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
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F7F9F5] backdrop-blur-sm rounded-3xl p-6">
          <div className="w-full max-w-xs rounded-2xl border border-rose-500/30 bg-white p-5 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6 text-[#AA524A]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1C3028]">¿Eliminar categoría?</p>
                <p className="text-xs text-[#475C50] mt-1">
                  <span className="font-semibold text-[#AA524A]">&quot;{categoriaAEliminar.nombre}&quot;</span> será eliminada.
                </p>
                <p className="text-[11px] text-[#7A897D] mt-1.5">
                  Los presupuestos de esta categoría se eliminan. Si tiene movimientos, no se podrá borrar: cámbialos o elimínalos primero.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-1">
                <button
                  type="button"
                  onClick={() => setCategoriaAEliminar(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-[#DCE4DB] text-[#475C50] hover:text-[#1C3028] hover:border-white/30 transition-all"
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
