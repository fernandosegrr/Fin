/** Conserva código, estado y detalles de PostgREST en `cause` para el registro del servidor. */
export function errorDeBaseDatos(error: { message: string }): Error {
  return new Error(error.message, { cause: error });
}
