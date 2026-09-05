/** Quote values embedded in PostgREST logic without letting punctuation alter filters. */
export function valorLogico(valor: string): string {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function patronBusqueda(valor: string): string {
  return `%${valor.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

export function paginaHistorial(limite = 50, offset = 0) {
  return {
    limite: Number.isFinite(limite) ? Math.min(50, Math.max(1, Math.trunc(limite))) : 50,
    offset: Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0,
  };
}
