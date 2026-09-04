/**
 * PostgREST (el API de Supabase) corta cualquier SELECT en 1000 filas
 * (`max-rows`) SIN avisar. Una consulta suelta de un mes con mucho
 * movimiento devolvía totales/presupuestos/exportaciones incompletos y la
 * UI los trataba como si fueran el mes completo.
 *
 * Paginar con `.range()` es la defensa que no requiere una función RPC
 * nueva en Postgres. Para el saldo histórico ya existe
 * `calcular_saldo_historico` (agrega en la BD); esto cubre el resto.
 */

export const TAM_PAGINA_POSTGREST = 1000;

export async function traerTodasLasFilas<T>(
  consultarPagina: (desde: number, hasta: number) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
  mensajeError: string,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA_POSTGREST) {
    const { data, error } = await consultarPagina(desde, desde + TAM_PAGINA_POSTGREST - 1);
    if (error) throw new Error(`${mensajeError}: ${error.message}`);
    const pagina = (data ?? []) as T[];
    filas.push(...pagina);
    if (pagina.length < TAM_PAGINA_POSTGREST) break;
  }
  return filas;
}
