import type { Categoria } from "@/lib/types";
import type { NaturalezaMovimiento } from "./types";

export function normalizarConcepto(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim();
}

/** Las reglas son aliases privados del usuario; nunca aprende de otra cuenta. */
export function sugerirCategoria(descripcion: string, categorias: Categoria[], tipo?: "ingreso" | "egreso"): Categoria | null {
  const texto = normalizarConcepto(descripcion);
  if (!texto) return null;
  const puntuadas = categorias.filter(c => !c.archivada && (!tipo || c.tipo === tipo)).map(c => {
    const coincidencias = (c.aliases ?? []).map(normalizarConcepto).filter(alias => {
      if (!alias) return false;
      const inicio = texto.indexOf(alias);
      return inicio >= 0 && (inicio === 0 || /[^a-z0-9]/.test(texto[inicio - 1]))
        && (inicio + alias.length === texto.length || /[^a-z0-9]/.test(texto[inicio + alias.length]));
    });
    return { c, puntos: Math.max(0, ...coincidencias.map(x => x.length)) };
  }).filter(x => x.puntos > 0).sort((a, b) => b.puntos - a.puntos);
  if (!puntuadas.length || (puntuadas[1] && puntuadas[1].puntos === puntuadas[0].puntos)) return null;
  return puntuadas[0].c;
}

export function naturalezaCategoria(categoria: Categoria): NaturalezaMovimiento {
  return categoria.naturaleza ?? categoria.tipo;
}
