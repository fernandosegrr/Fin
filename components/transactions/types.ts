import type { MetodoPago, TipoCategoria } from "@/lib/types";

export interface DatosNuevaTransaccion {
  id?: string;
  tipo: TipoCategoria;
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago: MetodoPago;
  fecha?: string;
  cliente_id?: string | null;
  cliente_nuevo?: string | null;
}
