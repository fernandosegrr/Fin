"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  esFechaISO,
  hoyEnMexico,
  hoyISOEnMexico,
  mesAnterior,
  nombreDelMes,
  primerDiaDelMes,
  rangoDelMes,
} from "@/lib/dates";
import { aNumero, formatearMonto, redondearMonto } from "@/lib/format";
import { traerTodasLasFilas } from "@/lib/supabase/paginar";
import type {
  Categoria,
  Cliente,
  EgresoPorCategoria,
  GastoRecurrente,
  IngresoPorCliente,
  MetaAhorro,
  GrupoCategoria,
  MetodoPago,
  Presupuesto,
  PresupuestoConGasto,
  ResumenMes,
  TipoCategoria,
  Transaccion,
  TransaccionConCategoria,
  Transferencia,
} from "@/lib/types";

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

function esMetodoPago(valor: unknown): valor is MetodoPago {
  return valor === "tarjeta" || valor === "efectivo";
}

function fechaOHoy(fecha?: string): string {
  if (!fecha) return hoyISOEnMexico();
  if (!esFechaISO(fecha)) throw new Error("La fecha no es válida.");
  return fecha;
}

async function exigirUsuario(supabase: ClienteSupabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  return user;
}

async function exigirCategoriaDelUsuario(
  supabase: ClienteSupabase,
  categoriaId: string,
): Promise<Categoria> {
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", categoriaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("La categoría no existe o no te pertenece.");
  return data as Categoria;
}

async function exigirClienteDelUsuario(
  supabase: ClienteSupabase,
  clienteId: string,
): Promise<Cliente> {
  const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("El cliente no existe o no te pertenece.");
  return data as Cliente;
}

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────

export async function obtenerCategorias(): Promise<Categoria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias").select("*").order("nombre");

  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
  return data ?? [];
}

export interface CrearCategoriaInput {
  nombre: string;
  tipo: TipoCategoria;
  grupo: GrupoCategoria | null;
}

export async function crearCategoria(input: CrearCategoriaInput): Promise<Categoria> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la categoría es requerido.");
  if (nombre.length > 60) throw new Error("El nombre de la categoría es demasiado largo (máx. 60 caracteres).");
  if (input.tipo === "egreso" && !input.grupo) {
    throw new Error("Las categorías de egreso deben ser Fijo o Variable.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { data: existentes, error: errorDuplicada } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("tipo", input.tipo);
  if (errorDuplicada) throw new Error(errorDuplicada.message);
  const nombreNorm = nombre.toLocaleLowerCase("es-MX");
  if ((existentes ?? []).some((c) => String(c.nombre).toLocaleLowerCase("es-MX") === nombreNorm)) {
    throw new Error("Ya tienes una categoría con ese nombre.");
  }

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      user_id: user.id,
      nombre,
      tipo: input.tipo,
      grupo: input.tipo === "ingreso" ? null : input.grupo,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  return data as Categoria;
}

export async function eliminarCategoria(id: string): Promise<void> {
  if (!id) throw new Error("ID de categoría inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { count, error: errorCount } = await supabase
    .from("transacciones")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if (errorCount) throw new Error(errorCount.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      `No se puede eliminar: hay ${count} movimiento${count === 1 ? "" : "s"} usando esta categoría. Cámbialos o elimínalos primero.`,
    );
  }

  const { error } = await supabase
    .from("categorias")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// TRANSACCIONES
// ─────────────────────────────────────────────

export interface NuevaTransaccion {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  /** Suscripción/gasto recurrente que originó este cobro, si aplica. */
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
}

export async function crearTransaccion(input: NuevaTransaccion): Promise<void> {
  if (!input.categoria_id) {
    throw new Error("Selecciona una categoría.");
  }
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  const metodoPago = input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  await exigirCategoriaDelUsuario(supabase, input.categoria_id);

  if (input.cliente_id) await exigirClienteDelUsuario(supabase, input.cliente_id);

  const { error } = await supabase.from("transacciones").insert({
    user_id: user.id,
    categoria_id: input.categoria_id,
    monto: redondearMonto(input.monto),
    fecha: fechaOHoy(input.fecha),
    descripcion: input.descripcion?.trim() || null,
    metodo_pago: metodoPago,
    gasto_recurrente_id: input.gasto_recurrente_id ?? null,
    cliente_id: input.cliente_id ?? null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export interface ActualizarTransaccionInput {
  categoria_id: string;
  monto: number;
  descripcion: string | null;
  metodo_pago?: MetodoPago;
  fecha?: string;
  cliente_id?: string | null;
}

export async function actualizarTransaccion(
  id: string,
  input: ActualizarTransaccionInput,
): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  const metodoPago = input.metodo_pago ?? "tarjeta";
  if (!esMetodoPago(metodoPago)) {
    throw new Error("El método de pago no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (input.cliente_id) await exigirClienteDelUsuario(supabase, input.cliente_id);

  const { error } = await supabase
    .from("transacciones")
    .update({
      categoria_id: input.categoria_id,
      monto: redondearMonto(input.monto),
      descripcion: input.descripcion?.trim() || null,
      metodo_pago: metodoPago,
      cliente_id: input.cliente_id ?? null,
      ...(input.fecha ? { fecha: fechaOHoy(input.fecha) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarTransaccion(id: string): Promise<void> {
  if (!id) throw new Error("ID de transacción inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transacciones")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// TRASPASOS ENTRE MÉTODOS DE PAGO (Efectivo ⇄ Tarjeta)
// ─────────────────────────────────────────────
// Un traspaso mueve saldo de un método a otro. No es ingreso ni egreso: el
// patrimonio total no cambia, por eso vive en su propia tabla y no toca
// categorías, presupuestos ni los totales de ingresos/egresos.

export interface NuevaTransferencia {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
}

export async function crearTransferencia(input: NuevaTransferencia): Promise<void> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase.from("transferencias").insert({
    user_id: user.id,
    monto: redondearMonto(input.monto),
    origen: input.origen,
    destino: input.destino,
    fecha: fechaOHoy(input.fecha),
    descripcion: input.descripcion?.trim() || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export interface ActualizarTransferenciaInput {
  monto: number;
  origen: MetodoPago;
  destino: MetodoPago;
  descripcion?: string | null;
  fecha?: string;
}

export async function actualizarTransferencia(
  id: string,
  input: ActualizarTransferenciaInput,
): Promise<void> {
  if (!id) throw new Error("ID de traspaso inválido.");
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto debe ser mayor a 0.");
  }
  if (!esMetodoPago(input.origen) || !esMetodoPago(input.destino)) {
    throw new Error("El método de pago no es válido.");
  }
  if (input.origen === input.destino) {
    throw new Error("Elige dos métodos de pago distintos.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transferencias")
    .update({
      monto: redondearMonto(input.monto),
      origen: input.origen,
      destino: input.destino,
      descripcion: input.descripcion?.trim() || null,
      ...(input.fecha ? { fecha: fechaOHoy(input.fecha) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarTransferencia(id: string): Promise<void> {
  if (!id) throw new Error("ID de traspaso inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("transferencias")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// BALANCE MENSUAL
// ─────────────────────────────────────────────

/** Fila mínima para agregar totales: es lo que seleccionan las consultas SIN límite de filas. */
type FilaParaTotales = {
  monto: number;
  metodo_pago?: MetodoPago;
  gasto_recurrente_id?: string | null;
  cliente_id?: string | null;
  categoria: { id: string; nombre: string; tipo: TipoCategoria; grupo: GrupoCategoria | null } | null;
  cliente?: { id: string; nombre: string } | null;
};

const SELECT_TOTALES =
  "monto, metodo_pago, gasto_recurrente_id, cliente_id, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)";
const SELECT_TOTALES_SIN_CLIENTE =
  "monto, metodo_pago, gasto_recurrente_id, categoria:categorias(id, nombre, tipo, grupo)";
const SELECT_LISTA =
  "*, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)";
const SELECT_LISTA_SIN_CLIENTE = "*, categoria:categorias(id, nombre, tipo, grupo)";

function esErrorEsquemaClientes(mensaje: string): boolean {
  return /clientes|cliente_id|schema cache/i.test(mensaje);
}

async function filasTotalesDelRango(
  supabase: ClienteSupabase,
  inicio: string,
  fin: string,
  mensajeError: string,
): Promise<FilaParaTotales[]> {
  try {
    return await traerTodasLasFilas<FilaParaTotales>(
      (desde, hasta) =>
        supabase.from("transacciones").select(SELECT_TOTALES).gte("fecha", inicio).lt("fecha", fin).range(desde, hasta),
      mensajeError,
    );
  } catch (err) {
    if (!esErrorEsquemaClientes(err instanceof Error ? err.message : String(err))) throw err;
    return traerTodasLasFilas<FilaParaTotales>(
      (desde, hasta) =>
        supabase
          .from("transacciones")
          .select(SELECT_TOTALES_SIN_CLIENTE)
          .gte("fecha", inicio)
          .lt("fecha", fin)
          .range(desde, hasta),
      mensajeError,
    );
  }
}

type TotalesCalculados = {
  ingresos: number;
  egresos: number;
  efectivo: { ingresos: number; egresos: number; neto: number };
  tarjeta: { ingresos: number; egresos: number; neto: number };
  egresosFijos: number;
  egresosVariables: number;
  egresosPorCategoria: EgresoPorCategoria[];
  ingresosPorCliente: IngresoPorCliente[];
  recurrentesCobrados: string[];
};

/**
 * Agrega TODO lo que la UI necesita del mes en una sola pasada sobre las filas
 * sin límite. Los desgloses por categoría / fijo-variable / suscripciones
 * cobradas viven aquí y no en los componentes a propósito: en el cliente solo
 * está disponible la lista recortada a 200 filas, así que calcularlos allá
 * daba números que no cuadraban con los totales en meses con mucho movimiento.
 */
function calcularTotalesDetallados(filas: FilaParaTotales[]): TotalesCalculados {
  let ingresos = 0;
  let egresos = 0;
  let egresosFijos = 0;
  let egresosVariables = 0;

  const efectivo = { ingresos: 0, egresos: 0, neto: 0 };
  const tarjeta = { ingresos: 0, egresos: 0, neto: 0 };
  const porCategoria = new Map<string, EgresoPorCategoria>();
  const porCliente = new Map<string, IngresoPorCliente>();
  const recurrentesCobrados = new Set<string>();

  for (const fila of filas) {
    if (fila.gasto_recurrente_id) recurrentesCobrados.add(fila.gasto_recurrente_id);

    const monto = aNumero(fila.monto);
    const esEfectivo = fila.metodo_pago === "efectivo";
    if (fila.categoria?.tipo === "ingreso") {
      ingresos += monto;
      if (esEfectivo) efectivo.ingresos += monto;
      else tarjeta.ingresos += monto;

      const clienteId = fila.cliente_id ?? fila.cliente?.id ?? "";
      const nombreCliente = fila.cliente?.nombre?.trim() || "Sin cliente";
      const claveCliente = clienteId || "__sin__";
      const acumCliente = porCliente.get(claveCliente);
      if (acumCliente) acumCliente.monto += monto;
      else porCliente.set(claveCliente, { cliente_id: clienteId || null, nombre: nombreCliente, monto });
    } else if (fila.categoria?.tipo === "egreso") {
      egresos += monto;
      if (esEfectivo) efectivo.egresos += monto;
      else tarjeta.egresos += monto;

      if (fila.categoria.grupo === "fijo") egresosFijos += monto;
      else if (fila.categoria.grupo === "variable") egresosVariables += monto;

      const acumulado = porCategoria.get(fila.categoria.id);
      if (acumulado) acumulado.monto += monto;
      else porCategoria.set(fila.categoria.id, {
        categoria_id: fila.categoria.id,
        nombre: fila.categoria.nombre,
        monto,
      });
    }
  }

  efectivo.neto = efectivo.ingresos - efectivo.egresos;
  tarjeta.neto = tarjeta.ingresos - tarjeta.egresos;

  return {
    ingresos: redondearMonto(ingresos),
    egresos: redondearMonto(egresos),
    efectivo: {
      ingresos: redondearMonto(efectivo.ingresos),
      egresos: redondearMonto(efectivo.egresos),
      neto: redondearMonto(efectivo.neto),
    },
    tarjeta: {
      ingresos: redondearMonto(tarjeta.ingresos),
      egresos: redondearMonto(tarjeta.egresos),
      neto: redondearMonto(tarjeta.neto),
    },
    egresosFijos: redondearMonto(egresosFijos),
    egresosVariables: redondearMonto(egresosVariables),
    egresosPorCategoria: [...porCategoria.values()]
      .map((e) => ({ ...e, monto: redondearMonto(e.monto) }))
      .sort((a, b) => b.monto - a.monto),
    ingresosPorCliente: [...porCliente.values()]
      .map((c) => ({ ...c, monto: redondearMonto(c.monto) }))
      .sort((a, b) => b.monto - a.monto),
    recurrentesCobrados: [...recurrentesCobrados],
  };
}

/**
 * Aplica traspasos entre métodos de pago al `neto` por método, in place.
 * Un traspaso NO es ingreso ni egreso (no toca `ingresos`/`egresos` totales):
 * solo mueve saldo de un método al otro, así que su efecto neto combinado
 * (efectivo.neto + tarjeta.neto) siempre es cero.
 */
function aplicarTransferencias(
  totales: TotalesCalculados,
  transferencias: { monto: number; origen: MetodoPago; destino: MetodoPago }[],
): void {
  for (const t of transferencias) {
    const monto = aNumero(t.monto);
    if (t.origen === "efectivo") totales.efectivo.neto -= monto;
    else totales.tarjeta.neto -= monto;

    if (t.destino === "efectivo") totales.efectivo.neto += monto;
    else totales.tarjeta.neto += monto;
  }
  totales.efectivo.neto = redondearMonto(totales.efectivo.neto);
  totales.tarjeta.neto = redondearMonto(totales.tarjeta.neto);
}

type SaldosHistoricos = { total: number; efectivo: number; tarjeta: number };

/**
 * Calcula el saldo histórico acumulado (suma de ingresos - egresos - traspasos
 * de TODO lo ocurrido ANTES de fechaLimite), separado por método de pago,
 * usando agregación en la base de datos para evitar cargar miles de filas.
 *
 * Esto es lo que hace que "Efectivo" y "Tarjeta" sean saldos reales que se
 * arrastran mes a mes (igual que el Saldo Total Disponible), en vez de
 * reiniciarse a los movimientos del mes en curso.
 */
async function calcularSaldosHistoricos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fechaLimite: string,
): Promise<SaldosHistoricos> {
  // Agregación hecha en Postgres (función calcular_saldo_historico, ver
  // prisma/migrations): suma TODO el historial sin traerlo a Node, así que no
  // hay techo de filas. El cálculo anterior traía cada transacción histórica
  // a JS y las sumaba ahí — por encima de las ~1000 filas que Supabase
  // devuelve por defecto en una consulta normal, el saldo quedaba mal sin
  // ningún aviso.
  const { data, error } = await supabase
    .rpc("calcular_saldo_historico", { p_fecha_limite: fechaLimite })
    .single();

  if (error) throw new Error(`No se pudo calcular el saldo histórico: ${error.message}`);

  // El cliente de Supabase no está tipado con las funciones RPC del proyecto
  // (no hay Database generado), así que el resultado llega como `unknown`.
  const fila = data as unknown as { efectivo: number | string; tarjeta: number | string } | null;
  const efectivo = redondearMonto(aNumero(fila?.efectivo));
  const tarjeta = redondearMonto(aNumero(fila?.tarjeta));
  return { total: redondearMonto(efectivo + tarjeta), efectivo, tarjeta };
}

export interface BalanceMensual {
  actual: ResumenMes & {
    nombreMes: string;
    transacciones: TransaccionConCategoria[];
    /** Total real de movimientos del mes (puede ser mayor que `transacciones.length` si se alcanzó el límite de 200). */
    totalTransaccionesMes: number;
  };
  anterior: ResumenMes & { nombreMes: string };
}

/**
 * Todas las transacciones del mes, SIN el límite de 200 filas de
 * `obtenerBalanceMensual` (esa limita por rendimiento de la vista principal).
 * Se usa solo bajo demanda para exportar a CSV, donde sí importa traer el
 * mes completo.
 */
export async function obtenerTransaccionesCompletasDelMes(
  anio: number,
  mes: number,
): Promise<TransaccionConCategoria[]> {
  const supabase = await createClient();
  const rango = rangoDelMes(anio, mes);

  return traerTodasLasFilas<TransaccionConCategoria>(
    (desde, hasta) =>
      supabase
        .from("transacciones")
        .select(SELECT_LISTA)
        .gte("fecha", rango.inicio)
        .lt("fecha", rango.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .range(desde, hasta),
    "No se pudieron cargar las transacciones del mes",
  );
}

export async function obtenerTransferenciasCompletasDelMes(
  anio: number,
  mes: number,
): Promise<Transferencia[]> {
  const supabase = await createClient();
  const rango = rangoDelMes(anio, mes);

  return traerTodasLasFilas<Transferencia>(
    (desde, hasta) =>
      supabase
        .from("transferencias")
        .select("*")
        .gte("fecha", rango.inicio)
        .lt("fecha", rango.finExclusivo)
        .order("fecha", { ascending: false })
        .range(desde, hasta),
    "No se pudieron cargar los traspasos del mes",
  );
}

export async function obtenerBalanceMensual(
  anioTarget?: number,
  mesTarget?: number,
): Promise<BalanceMensual> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;

  const anteriorYM = mesAnterior(anio, mes);
  const rangoActual = rangoDelMes(anio, mes);
  const rangoAnterior = rangoDelMes(anteriorYM.anio, anteriorYM.mes);

  // Cargamos, todo en paralelo:
  // - la LISTA de transacciones del mes actual a mostrar (limitada a 200 filas
  //   por rendimiento de UI — NO se usa para calcular totales, ver abajo)
  // - los TOTALES del mes actual, sin límite de filas (monto+metodo+tipo nada más)
  // - las transacciones del mes anterior (para la comparación), sin límite
  // - los traspasos del mes actual
  // - el saldo histórico acumulado por método, agregado en la base de datos
  const [resListaInicial, filasTotalesActual, filasAnterior, transferenciasActual, saldosHistoricos] =
    await Promise.all([
      supabase
        .from("transacciones")
        // count: "exact" pide a PostgREST el total real de filas que matchean
        // el filtro (vía header Content-Range) en la MISMA consulta, sin traer
        // más de las 200 que ya limitábamos — así la UI puede avisar si la
        // lista mostrada no es todo el mes, en vez de fallar en silencio.
        .select(SELECT_LISTA, { count: "exact" })
        .gte("fecha", rangoActual.inicio)
        .lt("fecha", rangoActual.finExclusivo)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .limit(200),
      filasTotalesDelRango(supabase, rangoActual.inicio, rangoActual.finExclusivo, "No se pudieron calcular los totales del mes"),
      filasTotalesDelRango(supabase, rangoAnterior.inicio, rangoAnterior.finExclusivo, "No se pudo cargar el mes anterior"),
      traerTodasLasFilas<Transferencia>(
        (desde, hasta) =>
          supabase
            .from("transferencias")
            .select("*")
            .gte("fecha", rangoActual.inicio)
            .lt("fecha", rangoActual.finExclusivo)
            .order("fecha", { ascending: false })
            .range(desde, hasta),
        "No se pudieron cargar los traspasos",
      ),
      calcularSaldosHistoricos(supabase, rangoActual.inicio),
    ]);

  let resLista = resListaInicial;
  if (resLista.error && esErrorEsquemaClientes(resLista.error.message)) {
    resLista = await supabase
      .from("transacciones")
      .select(SELECT_LISTA_SIN_CLIENTE, { count: "exact" })
      .gte("fecha", rangoActual.inicio)
      .lt("fecha", rangoActual.finExclusivo)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(200);
  }
  if (resLista.error) {
    throw new Error(`No se pudieron cargar las transacciones del mes: ${resLista.error.message}`);
  }

  const transaccionesActual = (resLista.data ?? []) as unknown as TransaccionConCategoria[];

  const totalesActual = calcularTotalesDetallados(filasTotalesActual);
  aplicarTransferencias(totalesActual, transferenciasActual);

  const totalesAnterior = calcularTotalesDetallados(filasAnterior);

  const balanceNetoActual = totalesActual.ingresos - totalesActual.egresos;

  return {
    actual: {
      anio,
      mes,
      nombreMes: nombreDelMes(anio, mes),
      ingresos: totalesActual.ingresos,
      egresos: totalesActual.egresos,
      balance: balanceNetoActual,
      saldoInicial: saldosHistoricos.total,
      saldoTotalDisponible: redondearMonto(saldosHistoricos.total + balanceNetoActual),
      totalesEfectivo: {
        ...totalesActual.efectivo,
        saldo: redondearMonto(saldosHistoricos.efectivo + totalesActual.efectivo.neto),
      },
      totalesTarjeta: {
        ...totalesActual.tarjeta,
        saldo: redondearMonto(saldosHistoricos.tarjeta + totalesActual.tarjeta.neto),
      },
      transferencias: transferenciasActual,
      egresosFijos: totalesActual.egresosFijos,
      egresosVariables: totalesActual.egresosVariables,
      egresosPorCategoria: totalesActual.egresosPorCategoria,
      ingresosPorCliente: totalesActual.ingresosPorCliente,
      recurrentesCobrados: totalesActual.recurrentesCobrados,
      transacciones: transaccionesActual,
      totalTransaccionesMes: resLista.count ?? transaccionesActual.length,
    },
    anterior: {
      anio: anteriorYM.anio,
      mes: anteriorYM.mes,
      nombreMes: nombreDelMes(anteriorYM.anio, anteriorYM.mes),
      ingresos: totalesAnterior.ingresos,
      egresos: totalesAnterior.egresos,
      balance: totalesAnterior.ingresos - totalesAnterior.egresos,
      saldoInicial: 0,
      saldoTotalDisponible: totalesAnterior.ingresos - totalesAnterior.egresos,
      totalesEfectivo: { ...totalesAnterior.efectivo, saldo: totalesAnterior.efectivo.neto },
      totalesTarjeta: { ...totalesAnterior.tarjeta, saldo: totalesAnterior.tarjeta.neto },
      transferencias: [],
      egresosFijos: totalesAnterior.egresosFijos,
      egresosVariables: totalesAnterior.egresosVariables,
      egresosPorCategoria: totalesAnterior.egresosPorCategoria,
      ingresosPorCliente: totalesAnterior.ingresosPorCliente,
      recurrentesCobrados: totalesAnterior.recurrentesCobrados,
    },
  };
}

// ─────────────────────────────────────────────
// PRESUPUESTOS
// ─────────────────────────────────────────────

export async function obtenerPresupuestosConGasto(
  anioTarget?: number,
  mesTarget?: number,
): Promise<PresupuestoConGasto[]> {
  const supabase = await createClient();
  const hoy = hoyEnMexico();
  const anio = anioTarget ?? hoy.anio;
  const mes = mesTarget ?? hoy.mes;
  const mesActualISO = primerDiaDelMes(anio, mes);
  const rango = rangoDelMes(anio, mes);

  const [resCategorias, resPresupuestos, transacciones] = await Promise.all([
    supabase.from("categorias").select("*").eq("tipo", "egreso").order("nombre"),
    supabase.from("presupuestos").select("*").eq("mes", mesActualISO),
    traerTodasLasFilas<Pick<Transaccion, "categoria_id" | "monto">>(
      (desde, hasta) =>
        supabase
          .from("transacciones")
          .select("categoria_id, monto")
          .gte("fecha", rango.inicio)
          .lt("fecha", rango.finExclusivo)
          .range(desde, hasta),
      "No se pudieron cargar los gastos del presupuesto",
    ),
  ]);

  if (resCategorias.error) throw new Error(resCategorias.error.message);
  if (resPresupuestos.error) throw new Error(resPresupuestos.error.message);

  const categoriasEgreso = (resCategorias.data ?? []) as Categoria[];
  const presupuestos = (resPresupuestos.data ?? []) as Presupuesto[];

  const gastoPorCategoria = new Map<string, number>();
  for (const t of transacciones) {
    gastoPorCategoria.set(
      t.categoria_id,
      redondearMonto((gastoPorCategoria.get(t.categoria_id) ?? 0) + aNumero(t.monto)),
    );
  }
  const presupuestoPorCategoria = new Map(presupuestos.map((p) => [p.categoria_id, p]));

  return categoriasEgreso.map((categoria) => ({
    categoria,
    presupuesto: presupuestoPorCategoria.get(categoria.id) ?? null,
    gastado: gastoPorCategoria.get(categoria.id) ?? 0,
  }));
}

export async function guardarPresupuesto(
  categoria_id: string,
  monto_limite: number,
  mesISO: string,
): Promise<void> {
  if (!categoria_id) throw new Error("Selecciona una categoría.");
  if (!esFechaISO(mesISO) || !mesISO.endsWith("-01")) {
    throw new Error("El mes del presupuesto no es válido.");
  }

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  await exigirCategoriaDelUsuario(supabase, categoria_id);

  if (!Number.isFinite(monto_limite) || monto_limite <= 0) {
    const { error } = await supabase
      .from("presupuestos")
      .delete()
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO);
    if (error) throw new Error(error.message);
  } else {
    const limite = redondearMonto(monto_limite);
    const { data: existente, error: errorBusqueda } = await supabase
      .from("presupuestos")
      .select("id")
      .eq("user_id", user.id)
      .eq("categoria_id", categoria_id)
      .eq("mes", mesISO)
      .maybeSingle();
    if (errorBusqueda) throw new Error(errorBusqueda.message);

    if (existente) {
      const { error } = await supabase
        .from("presupuestos")
        .update({ monto_limite: limite })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("presupuestos").insert({
        user_id: user.id,
        categoria_id,
        monto_limite: limite,
        mes: mesISO,
      });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath("/dashboard");
}

export type ResultadoCopiaPresupuestos =
  | { ok: true; copiados: number }
  | { ok: false; error: string };

/**
 * Copia al mes `mesISO` los presupuestos del mes anterior que todavía no
 * existen en ese mes. No pisa límites que el usuario ya haya puesto.
 */
export async function copiarPresupuestosMesAnterior(
  mesISO: string,
): Promise<ResultadoCopiaPresupuestos> {
  try {
    if (!esFechaISO(mesISO) || !mesISO.endsWith("-01")) {
      return { ok: false, error: "El mes del presupuesto no es válido." };
    }
    const [anioStr, mesStr] = mesISO.split("-");
    const anio = Number(anioStr);
    const mes = Number(mesStr);
    const previo = mesAnterior(anio, mes);
    const mesAnteriorISO = primerDiaDelMes(previo.anio, previo.mes);

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);

    const [resAnterior, resActual] = await Promise.all([
      supabase
        .from("presupuestos")
        .select("categoria_id, monto_limite")
        .eq("user_id", user.id)
        .eq("mes", mesAnteriorISO),
      supabase
        .from("presupuestos")
        .select("categoria_id")
        .eq("user_id", user.id)
        .eq("mes", mesISO),
    ]);
    if (resAnterior.error) return { ok: false, error: resAnterior.error.message };
    if (resActual.error) return { ok: false, error: resActual.error.message };

    const anteriores = resAnterior.data ?? [];
    if (anteriores.length === 0) {
      return { ok: false, error: "El mes anterior no tiene presupuestos para copiar." };
    }

    const yaTienen = new Set((resActual.data ?? []).map((p) => p.categoria_id as string));
    const aCopiar = anteriores.filter((p) => !yaTienen.has(p.categoria_id as string));
    if (aCopiar.length === 0) {
      return { ok: false, error: "Este mes ya tiene límite en todas las categorías del mes anterior." };
    }

    const { error } = await supabase.from("presupuestos").insert(
      aCopiar.map((p) => ({
        user_id: user.id,
        categoria_id: p.categoria_id,
        monto_limite: p.monto_limite,
        mes: mesISO,
      })),
    );
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return { ok: true, copiados: aCopiar.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudieron copiar los presupuestos.",
    };
  }
}

// ─────────────────────────────────────────────
// GASTOS RECURRENTES (ahora en Supabase, no localStorage)
// ─────────────────────────────────────────────

export async function obtenerGastosRecurrentes(): Promise<GastoRecurrente[]> {
  const supabase = await createClient();

  // Sin getUser()/`.eq("user_id", ...)` a propósito: es una lectura y RLS ya
  // filtra por auth.uid() automáticamente (igual que obtenerCategorias/
  // obtenerBalanceMensual). getUser() hace un round-trip de red aparte a
  // Supabase Auth — costoso repetirlo en cada lectura cuando esta función
  // corre en paralelo con otras 3 dentro de un mismo Promise.all (carga
  // inicial del dashboard) y termina siendo la que más tarda.
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .select("*, categoria:categorias(id, nombre, tipo, grupo)")
    .order("dia_cobro");

  if (error) throw new Error(`No se pudieron cargar los gastos recurrentes: ${error.message}`);

  return (data ?? []) as unknown as GastoRecurrente[];
}

export interface NuevoGastoRecurrente {
  nombre: string;
  monto: number;
  dia_cobro: number;
  categoria_id: string;
  metodo_pago: MetodoPago;
}

export async function crearGastoRecurrente(input: NuevoGastoRecurrente): Promise<void> {
  if (!input.nombre.trim()) throw new Error("El nombre es requerido.");
  if (input.nombre.trim().length > 80) throw new Error("El nombre es demasiado largo (máx. 80 caracteres).");
  if (!Number.isFinite(input.monto) || input.monto <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (input.dia_cobro < 1 || input.dia_cobro > 31) throw new Error("El día de cobro debe estar entre 1 y 31.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!esMetodoPago(input.metodo_pago)) throw new Error("El método de pago no es válido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (categoria.tipo !== "egreso") {
    throw new Error("Las suscripciones deben usarse con una categoría de egreso.");
  }

  const { error } = await supabase.from("gastos_recurrentes").insert({
    user_id: user.id,
    nombre: input.nombre.trim(),
    monto: redondearMonto(input.monto),
    dia_cobro: input.dia_cobro,
    categoria_id: input.categoria_id,
    metodo_pago: input.metodo_pago,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function actualizarGastoRecurrente(
  id: string,
  input: NuevoGastoRecurrente,
): Promise<void> {
  if (!id) throw new Error("ID inválido.");
  if (!input.nombre.trim()) throw new Error("El nombre es requerido.");
  if (input.nombre.trim().length > 80) throw new Error("El nombre es demasiado largo (máx. 80 caracteres).");
  if (!Number.isFinite(input.monto) || input.monto <= 0) throw new Error("El monto debe ser mayor a 0.");
  if (input.dia_cobro < 1 || input.dia_cobro > 31) throw new Error("El día de cobro debe estar entre 1 y 31.");
  if (!input.categoria_id) throw new Error("Selecciona una categoría.");
  if (!esMetodoPago(input.metodo_pago)) throw new Error("El método de pago no es válido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const categoria = await exigirCategoriaDelUsuario(supabase, input.categoria_id);
  if (categoria.tipo !== "egreso") {
    throw new Error("Las suscripciones deben usarse con una categoría de egreso.");
  }

  const { error } = await supabase
    .from("gastos_recurrentes")
    .update({
      nombre: input.nombre.trim(),
      monto: redondearMonto(input.monto),
      dia_cobro: input.dia_cobro,
      categoria_id: input.categoria_id,
      metodo_pago: input.metodo_pago,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

export async function eliminarGastoRecurrente(id: string): Promise<void> {
  if (!id) throw new Error("ID inválido.");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { error } = await supabase
    .from("gastos_recurrentes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}

const NOMBRE_CATEGORIA_AJUSTE = "Ajuste de saldo";

async function asegurarCategoriaAjuste(
  supabase: ClienteSupabase,
  userId: string,
  tipo: TipoCategoria,
): Promise<string> {
  const { data: existente, error: errorBusqueda } = await supabase
    .from("categorias")
    .select("id")
    .eq("tipo", tipo)
    .eq("nombre", NOMBRE_CATEGORIA_AJUSTE)
    .maybeSingle();
  if (errorBusqueda) throw new Error(errorBusqueda.message);
  if (existente?.id) return existente.id as string;

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      user_id: userId,
      nombre: NOMBRE_CATEGORIA_AJUSTE,
      tipo,
      grupo: tipo === "egreso" ? "variable" : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export type ResultadoAjusteSaldo =
  | { ok: true; diferencia: number }
  | { ok: false; error: string };

/**
 * Iguala el saldo de un método al monto que el usuario tiene de verdad.
 * Crea un ingreso o egreso de categoría "Ajuste de saldo" con fecha de hoy
 * (México), para no reescribir el historial.
 */
export async function ajustarSaldo(
  metodo: MetodoPago,
  saldoObjetivo: number,
): Promise<ResultadoAjusteSaldo> {
  try {
    if (!esMetodoPago(metodo)) return { ok: false, error: "El método de pago no es válido." };
    if (!Number.isFinite(saldoObjetivo)) return { ok: false, error: "Ingresa un saldo válido." };

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);
    const balance = await obtenerBalanceMensual();
    const actual =
      metodo === "efectivo" ? balance.actual.totalesEfectivo.saldo : balance.actual.totalesTarjeta.saldo;
    const diferencia = redondearMonto(saldoObjetivo - actual);
    if (Math.abs(diferencia) < 0.01) {
      return { ok: false, error: "Ese método ya está en ese saldo." };
    }

    const tipo: TipoCategoria = diferencia > 0 ? "ingreso" : "egreso";
    const categoriaId = await asegurarCategoriaAjuste(supabase, user.id, tipo);
    const { error } = await supabase.from("transacciones").insert({
      user_id: user.id,
      categoria_id: categoriaId,
      monto: Math.abs(diferencia),
      fecha: hoyISOEnMexico(),
      descripcion: `Ajuste a saldo real (${formatearMonto(saldoObjetivo)})`,
      metodo_pago: metodo,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return { ok: true, diferencia };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo ajustar el saldo." };
  }
}

// ─────────────────────────────────────────────
// CLIENTES / PROYECTOS
// ─────────────────────────────────────────────

export async function obtenerClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("id, user_id, nombre").order("nombre");
  if (error) {
    if (esErrorEsquemaClientes(error.message)) return [];
    throw new Error(`No se pudieron cargar los clientes: ${error.message}`);
  }
  return (data ?? []) as Cliente[];
}

export async function crearCliente(nombreCrudo: string): Promise<Cliente> {
  const nombre = nombreCrudo.trim();
  if (!nombre) throw new Error("El nombre del cliente es requerido.");
  if (nombre.length > 60) throw new Error("El nombre es demasiado largo (máx. 60 caracteres).");

  const supabase = await createClient();
  const user = await exigirUsuario(supabase);

  const { data: existentes, error: errorExistentes } = await supabase.from("clientes").select("id, nombre");
  if (errorExistentes) throw new Error(errorExistentes.message);
  const norm = nombre.toLocaleLowerCase("es-MX");
  const ya = (existentes ?? []).find((c) => String(c.nombre).toLocaleLowerCase("es-MX") === norm);
  if (ya) return ya as Cliente;

  const { data, error } = await supabase
    .from("clientes")
    .insert({ user_id: user.id, nombre })
    .select("id, user_id, nombre")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  return data as Cliente;
}

export async function eliminarCliente(id: string): Promise<void> {
  if (!id) throw new Error("ID de cliente inválido.");
  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const { error } = await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// META DE AHORRO
// ─────────────────────────────────────────────

export async function obtenerMetaAhorro(): Promise<MetaAhorro | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metas_ahorro")
    .select("id, nombre, monto_objetivo, fecha_limite")
    .maybeSingle();
  if (error) {
    if (esErrorEsquemaClientes(error.message) || /metas_ahorro/i.test(error.message)) return null;
    throw new Error(`No se pudo cargar la meta de ahorro: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id as string,
    nombre: data.nombre as string,
    monto_objetivo: aNumero(data.monto_objetivo),
    fecha_limite: (data.fecha_limite as string | null) ?? null,
  };
}

export type ResultadoMetaAhorro = { ok: true; meta: MetaAhorro } | { ok: false; error: string };

export async function guardarMetaAhorro(input: {
  nombre: string;
  monto_objetivo: number;
  fecha_limite?: string | null;
}): Promise<ResultadoMetaAhorro> {
  try {
    const nombre = input.nombre.trim();
    if (!nombre) return { ok: false, error: "Ponle un nombre a la meta." };
    if (!Number.isFinite(input.monto_objetivo) || input.monto_objetivo <= 0) {
      return { ok: false, error: "El objetivo debe ser mayor a 0." };
    }
    const fechaLimite = input.fecha_limite?.trim() || null;
    if (fechaLimite && !esFechaISO(fechaLimite)) return { ok: false, error: "La fecha límite no es válida." };

    const supabase = await createClient();
    const user = await exigirUsuario(supabase);
    const payload = {
      user_id: user.id,
      nombre,
      monto_objetivo: redondearMonto(input.monto_objetivo),
      fecha_limite: fechaLimite,
    };

    const { data: existente } = await supabase.from("metas_ahorro").select("id").maybeSingle();
    const query = existente
      ? supabase.from("metas_ahorro").update(payload).eq("id", existente.id)
      : supabase.from("metas_ahorro").insert(payload);

    const { data, error } = await query.select("id, nombre, monto_objetivo, fecha_limite").single();
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    return {
      ok: true,
      meta: {
        id: data.id as string,
        nombre: data.nombre as string,
        monto_objetivo: aNumero(data.monto_objetivo),
        fecha_limite: (data.fecha_limite as string | null) ?? null,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar la meta." };
  }
}

export async function eliminarMetaAhorro(): Promise<void> {
  const supabase = await createClient();
  const user = await exigirUsuario(supabase);
  const { error } = await supabase.from("metas_ahorro").delete().eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────
// HISTORIAL GLOBAL
// ─────────────────────────────────────────────

function escaparIlike(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function buscarTransacciones(input: {
  busqueda?: string;
  tipo?: "todos" | TipoCategoria;
  metodoPago?: "todos" | MetodoPago;
  limite?: number;
  offset?: number;
}): Promise<{ filas: TransaccionConCategoria[]; total: number }> {
  const supabase = await createClient();
  const limite = Math.min(50, Math.max(1, input.limite ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const busqueda = input.busqueda?.trim() ?? "";

  const usaInnerTipo = Boolean(input.tipo && input.tipo !== "todos");
  const select = usaInnerTipo
    ? "*, categoria:categorias!inner(id, nombre, tipo, grupo), cliente:clientes(id, nombre)"
    : "*, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)";

  let query = supabase
    .from("transacciones")
    .select(select, { count: "exact" })
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });

  if (usaInnerTipo) query = query.eq("categorias.tipo", input.tipo);
  if (input.metodoPago && input.metodoPago !== "todos") {
    query = query.eq("metodo_pago", input.metodoPago);
  }

  if (busqueda) {
    const q = `%${escaparIlike(busqueda)}%`;
    const [{ data: cats }, { data: clis }] = await Promise.all([
      supabase.from("categorias").select("id").ilike("nombre", q),
      supabase.from("clientes").select("id").ilike("nombre", q),
    ]);
    const partes = [`descripcion.ilike.${q}`];
    const catIds = (cats ?? []).map((c) => c.id as string);
    const cliIds = (clis ?? []).map((c) => c.id as string);
    if (catIds.length) partes.push(`categoria_id.in.(${catIds.join(",")})`);
    if (cliIds.length) partes.push(`cliente_id.in.(${cliIds.join(",")})`);
    query = query.or(partes.join(","));
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  if (error) {
    if (esErrorEsquemaClientes(error.message)) {
      const fallback = await supabase
        .from("transacciones")
        .select(SELECT_LISTA_SIN_CLIENTE, { count: "exact" })
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })
        .range(offset, offset + limite - 1);
      if (fallback.error) throw new Error(`No se pudo buscar el historial: ${fallback.error.message}`);
      return { filas: (fallback.data ?? []) as unknown as TransaccionConCategoria[], total: fallback.count ?? 0 };
    }
    throw new Error(`No se pudo buscar el historial: ${error.message}`);
  }
  return { filas: (data ?? []) as unknown as TransaccionConCategoria[], total: count ?? 0 };
}

/**
 * Busca traspasos entre métodos de pago para el Historial. Un traspaso toca
 * DOS métodos (origen y destino): filtrar por `metodoPago` incluye el
 * traspaso si cualquiera de los dos coincide, no solo el destino.
 */
export async function buscarTransferencias(input: {
  busqueda?: string;
  metodoPago?: "todos" | MetodoPago;
  limite?: number;
  offset?: number;
}): Promise<{ filas: Transferencia[]; total: number }> {
  const supabase = await createClient();
  const limite = Math.min(50, Math.max(1, input.limite ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const busqueda = input.busqueda?.trim() ?? "";

  let query = supabase
    .from("transferencias")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });

  if (input.metodoPago && input.metodoPago !== "todos") {
    query = query.or(`origen.eq.${input.metodoPago},destino.eq.${input.metodoPago}`);
  }
  if (busqueda) {
    query = query.ilike("descripcion", `%${escaparIlike(busqueda)}%`);
  }

  const { data, error, count } = await query.range(offset, offset + limite - 1);
  if (error) throw new Error(`No se pudieron buscar los traspasos: ${error.message}`);
  return { filas: (data ?? []) as Transferencia[], total: count ?? 0 };
}
