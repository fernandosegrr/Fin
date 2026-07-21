"use client";

import { useEffect, useMemo, useState } from "react";
import { X, PlusCircle, Pencil, Trash2, Tag, Plus } from "lucide-react";
import { GlowButton } from "@/components/react-bits/GlowButton";
import { CategoryManagerModal } from "./category-manager-modal";
import type { Categoria, TipoCategoria, TransaccionConCategoria } from "@/lib/types";

export interface DatosNuevaTransaccion {
  id?: string;
  tipo: TipoCategoria;
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  fecha?: string;
}

interface Props {
  categorias: Categoria[];
  abierto: boolean;
  transaccionEditar?: TransaccionConCategoria | null;
  onCerrar: () => void;
  onEnviar: (datos: DatosNuevaTransaccion) => void;
  onEliminar?: (id: string) => void;
}

export function TransactionCaptureModal({
  categorias,
  abierto,
  transaccionEditar,
  onCerrar,
  onEnviar,
  onEliminar,
}: Props) {
  const [tipo, setTipo] = useState<TipoCategoria>("egreso");
  const [montoTexto, setMontoTexto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);

  const esEdicion = Boolean(transaccionEditar);

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.tipo === tipo),
    [categorias, tipo],
  );

  function cambiarTipo(nuevoTipo: TipoCategoria) {
    setTipo(nuevoTipo);
    setError(null);
    const primeraCat = categorias.find((c) => c.tipo === nuevoTipo);
    if (primeraCat) {
      setCategoriaId(primeraCat.id);
    } else {
      setCategoriaId("");
    }
  }

  useEffect(() => {
    if (abierto) {
      if (transaccionEditar) {
        const tTipo = transaccionEditar.categoria?.tipo || "egreso";
        setTipo(tTipo);
        setMontoTexto(String(transaccionEditar.monto));
        setCategoriaId(transaccionEditar.categoria_id);
        setDescripcion(transaccionEditar.descripcion || "");
        setFecha(transaccionEditar.fecha || "");
      } else {
        setTipo("egreso");
        setMontoTexto("");
        setDescripcion("");
        setFecha("");
        const primeraEgreso = categorias.find((c) => c.tipo === "egreso");
        setCategoriaId(primeraEgreso?.id ?? "");
      }
      setError(null);
    }
  }, [abierto, transaccionEditar, categorias]);

  if (!abierto) return null;

  function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number.parseFloat(montoTexto.replace(",", "."));

    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Ingresa un monto válido mayor a 0.");
      return;
    }
    if (!categoriaId) {
      setError("Selecciona o crea una categoría.");
      return;
    }

    onEnviar({
      id: transaccionEditar?.id,
      tipo,
      categoria_id: categoriaId,
      monto,
      descripcion: descripcion.trim() || null,
      fecha: fecha || undefined,
    });
    onCerrar();
  }

  function manejarEliminar() {
    if (transaccionEditar && onEliminar) {
      if (confirm("¿Estás seguro de que deseas eliminar este movimiento?")) {
        onEliminar(transaccionEditar.id);
        onCerrar();
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {esEdicion ? (
                <>
                  <Pencil className="h-4 w-4 text-indigo-400" />
                  Editar Movimiento
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 text-emerald-400" />
                  Nuevo Movimiento
                </>
              )}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={manejarEnvio} className="mt-4 space-y-4">
            {/* Toggle Ingreso / Egreso */}
            <div className="flex rounded-2xl bg-slate-950 p-1.5 border border-white/5">
              <button
                type="button"
                onClick={() => cambiarTipo("egreso")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tipo === "egreso"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Egreso (−)
              </button>
              <button
                type="button"
                onClick={() => cambiarTipo("ingreso")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  tipo === "ingreso"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Ingreso (+)
              </button>
            </div>

            {/* Input de Monto */}
            <div>
              <label htmlFor="monto" className="block text-xs font-medium text-slate-400 mb-1">
                Monto
              </label>
              <div className="relative flex items-center rounded-2xl bg-slate-950/80 border border-white/10 px-4 py-3 focus-within:border-emerald-400/60">
                <span className="text-2xl font-bold text-slate-400 mr-2">$</span>
                <input
                  id="monto"
                  name="monto"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={montoTexto}
                  onChange={(e) => setMontoTexto(e.target.value)}
                  className="w-full bg-transparent text-3xl font-extrabold text-slate-100 placeholder:text-slate-700 focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="categoria" className="block text-xs font-medium text-slate-400">
                  Categoría ({tipo})
                </label>
                <button
                  type="button"
                  onClick={() => setModalCategoriasAbierto(true)}
                  className="text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Crear Categoría
                </button>
              </div>

              <div className="relative">
                {categoriasFiltradas.length === 0 ? (
                  <div className="p-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 text-xs text-slate-300 flex items-center justify-between">
                    <span>No tienes categorías de {tipo}</span>
                    <button
                      type="button"
                      onClick={() => setModalCategoriasAbierto(true)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition-all"
                    >
                      + Crear Ahora
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      id="categoria"
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 focus:border-indigo-400/60 focus:outline-none appearance-none"
                    >
                      {categoriasFiltradas.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.nombre} {c.grupo ? `(${c.grupo})` : ""}
                        </option>
                      ))}
                    </select>
                    <Tag className="absolute right-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                  </>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="descripcion" className="block text-xs font-medium text-slate-400 mb-1">
                Descripción (opcional)
              </label>
              <input
                id="descripcion"
                type="text"
                placeholder="Ej. Nómina, Freelance, Proyecto..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/60 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            )}

            {/* Acciones */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {esEdicion ? (
                <GlowButton type="button" variant="danger" onClick={manejarEliminar}>
                  <Trash2 className="h-4 w-4" /> Eliminar
                </GlowButton>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <GlowButton type="button" variant="secondary" onClick={onCerrar}>
                  Cancelar
                </GlowButton>
                <GlowButton type="submit" variant="primary" disabled={!categoriaId}>
                  {esEdicion ? "Guardar" : "Agregar"}
                </GlowButton>
              </div>
            </div>
          </form>
        </div>
      </div>

      <CategoryManagerModal
        categorias={categorias}
        abierto={modalCategoriasAbierto}
        onCerrar={() => setModalCategoriasAbierto(false)}
      />
    </>
  );
}
