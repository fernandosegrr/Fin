import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aNumero } from "@/lib/format";
import { exigirUsuario } from "./shared";
import { montoPositivo } from "./validation";
import { esFechaISO, hoyISOEnMexico } from "@/lib/dates";
import type { CuentaFinanciera } from "@/lib/finance/types";

export function normalizarCuenta(c: CuentaFinanciera): CuentaFinanciera {
  return { ...c, tasa_anual: aNumero(c.tasa_anual), tasa_excedente: aNumero(c.tasa_excedente), tasa_superior: aNumero(c.tasa_superior), retencion_anual: aNumero(c.retencion_anual), limite_preferente: aNumero(c.limite_preferente), limite_segundo_tramo: aNumero(c.limite_segundo_tramo) };
}

export async function obtenerCuentas(): Promise<CuentaFinanciera[]> {
  const db = await createClient();
  let r = await db.from("cuentas_financieras").select("*").order("creado_en").order("id");
  if (r.error) throw new Error(`No se pudieron cargar las cuentas: ${r.error.message}`);
  if (!r.data?.length) {
    const setup = await db.rpc("asegurar_cuentas_financieras");
    if (setup.error) throw new Error(setup.error.message);
    r = await db.from("cuentas_financieras").select("*").order("creado_en").order("id");
    if (r.error) throw new Error(r.error.message);
  }
  return ((r.data ?? []) as CuentaFinanciera[]).map(normalizarCuenta);
}

export async function exigirCuenta(id: string): Promise<CuentaFinanciera> {
  const db = await createClient();
  const { data, error } = await db.from("cuentas_financieras").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.archivada) throw new Error("La cuenta no existe, está archivada o no te pertenece.");
  return normalizarCuenta(data as CuentaFinanciera);
}

export async function guardarCuenta(input: { id?: string; nombre: string; tipo: CuentaFinanciera["tipo"]; banco?: string | null; remunerada?: boolean; rendimiento_desde?: string | null; tasa_anual?: number; retencion_anual?: number; plan?: string | null }) {
  const db = await createClient(); const user = await exigirUsuario(db);
  const nombre = input.nombre.trim();
  if (!nombre || nombre.length > 80) throw new Error("Usa un nombre de hasta 80 caracteres.");
  if (!["efectivo", "principal", "ahorro", "reserva"].includes(input.tipo)) throw new Error("El tipo de cuenta no es válido.");
  if (input.rendimiento_desde && !esFechaISO(input.rendimiento_desde)) throw new Error("La fecha no es válida.");
  const tasa = Number(input.tasa_anual ?? 0), impuesto = Number(input.retencion_anual ?? 0);
  if (![tasa, impuesto].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error("Las tasas deben estar entre 0 y 100%.");
  const existente = input.id ? await exigirCuenta(input.id) : null;
  const todas = await obtenerCuentas();
  const esRevolut = input.banco?.trim().toLocaleLowerCase("es-MX") === "revolut";
  const grupoRendimiento = input.remunerada ? (esRevolut ? "revolut-personal-mxn" : existente?.grupo_rendimiento && existente.banco === (input.banco?.trim() || null) ? existente.grupo_rendimiento : `cuenta-${input.id || crypto.randomUUID()}`) : null;
  const referencia = grupoRendimiento ? todas.find(c => c.grupo_rendimiento === grupoRendimiento && !c.archivada) : null;
  const tasaCompartida = !existente && referencia ? referencia.tasa_anual : tasa;
  const retencionCompartida = !existente && referencia ? referencia.retencion_anual : impuesto;
  const payload = {
    nombre, tipo: input.tipo, banco: input.banco?.trim() || null,
    metodo_pago: input.tipo === "efectivo" ? "efectivo" : "tarjeta",
    excluida_disponible: input.tipo === "ahorro" || input.tipo === "reserva",
    grupo_rendimiento: grupoRendimiento,
    rendimiento_desde: input.remunerada ? input.rendimiento_desde : null,
    tasa_anual: input.remunerada ? tasaCompartida : 0, retencion_anual: input.remunerada ? retencionCompartida : 0,
    tasa_excedente: referencia?.tasa_excedente ?? (esRevolut ? 7 : tasaCompartida),
    tasa_superior: referencia?.tasa_superior ?? (esRevolut ? 4.5 : tasaCompartida),
    limite_preferente: referencia?.limite_preferente ?? 25000,
    limite_segundo_tramo: referencia?.limite_segundo_tramo ?? 1000000,
    plan: input.plan || referencia?.plan || null,
  };
  if (input.remunerada && !payload.rendimiento_desde) throw new Error("Indica desde cuándo genera rendimientos.");
  const id = existente?.id || crypto.randomUUID();
  const cambios: { antes: CuentaFinanciera | null; despues: Record<string, unknown> }[] = [{ antes: existente, despues: { ...payload, id, user_id: user.id, ...(existente ? {} : { codigo: `cuenta-${id}` }) } }];
  for (const hermana of todas.filter(c => grupoRendimiento && c.grupo_rendimiento === grupoRendimiento && c.id !== id)) cambios.push({ antes: hermana, despues: { id: hermana.id, user_id: user.id, tasa_anual: payload.tasa_anual, tasa_excedente: payload.tasa_excedente, tasa_superior: payload.tasa_superior, retencion_anual: payload.retencion_anual, plan: payload.plan } });
  cambios.sort((a, b) => String(a.despues.id).localeCompare(String(b.despues.id)));
  const r = await db.rpc("aplicar_plan_financiero", { p_plan: { cuentas_financieras: cambios }, p_lote: crypto.randomUUID(), p_nombre: "Actualizar cuentas y tasas" });
  if (r.error) throw new Error(r.error.message);
  revalidatePath("/dashboard");
}

export async function registrarRendimiento(input: { cuenta_id: string; fecha: string; neto?: number; bruto?: number; retencion?: number; descripcion?: string; clave_solicitud: string }) {
  const cuenta = await exigirCuenta(input.cuenta_id);
  if (!cuenta.grupo_rendimiento) throw new Error("Esta cuenta no tiene rendimientos configurados.");
  if (!esFechaISO(input.fecha)) throw new Error("La fecha no es válida.");
  const db = await createClient(); const user = await exigirUsuario(db);
  const bruto = input.bruto == null ? null : montoPositivo(input.bruto);
  const retencion = input.retencion == null ? null : Number(input.retencion);
  if (retencion !== null && (!Number.isFinite(retencion) || retencion < 0)) throw new Error("La retención no es válida.");
  if ((bruto === null) !== (retencion === null)) throw new Error("Indica bruto y retención juntos, o solamente el neto.");
  const neto = montoPositivo(bruto === null ? Number(input.neto) : bruto - retencion!);
  const { data: cats, error: ec } = await db.from("categorias").select("id").eq("naturaleza", "rendimiento").eq("archivada", false).limit(1);
  if (ec) throw new Error(ec.message);
  let categoriaId = cats?.[0]?.id;
  if (!categoriaId) {
    const { data, error } = await db.from("categorias").insert({ user_id: user.id, nombre: "Rendimientos", familia: "Ingresos financieros", tipo: "ingreso", grupo: null, naturaleza: "rendimiento" }).select("id").single();
    if (error) throw new Error(error.message);
    categoriaId = data.id;
  }
  const { error } = await db.from("transacciones").insert({ user_id: user.id, cuenta_id: cuenta.id, categoria_id: categoriaId, naturaleza: "rendimiento", monto: neto, interes_bruto: bruto, impuesto_retenido: retencion, fecha: input.fecha, metodo_pago: cuenta.metodo_pago, descripcion: input.descripcion?.trim() || "Interés acreditado", clave_solicitud: input.clave_solicitud });
  if (error) {
    const repetida = error.code === "23505" ? await db.from("transacciones").select("id").eq("user_id", user.id).eq("clave_solicitud", input.clave_solicitud).maybeSingle() : null;
    if (!repetida?.data) throw new Error(error.message);
  }
  revalidatePath("/dashboard");
}

export async function ajustarSaldoCuenta(cuentaId: string, saldoObjetivo: number, motivo: string) {
  if (!Number.isFinite(saldoObjetivo)) throw new Error("El saldo no es válido.");
  if (!motivo.trim()) throw new Error("Indica el motivo de la conciliación.");
  const cuenta = await exigirCuenta(cuentaId);
  const { obtenerBalanceMensual } = await import("./balance");
  const balance = await obtenerBalanceMensual();
  const saldo = balance.actual.finanzas?.cuentas.find(c => c.id === cuentaId)?.saldo;
  if (saldo === undefined) throw new Error("No se pudo leer el saldo actual.");
  const diferencia = Math.round((saldoObjetivo - saldo) * 100) / 100;
  if (Math.abs(diferencia) < .01) return { diferencia: 0 };
  const db = await createClient(); const user = await exigirUsuario(db);
  const naturaleza = diferencia > 0 ? "ajuste_entrada" : "ajuste_salida";
  const { data: existentes, error: ec } = await db.from("categorias").select("id").eq("naturaleza", naturaleza).limit(1);
  if (ec) throw new Error(ec.message);
  let id = existentes?.[0]?.id;
  if (!id) {
    const { data, error } = await db.from("categorias").insert({ user_id: user.id, nombre: diferencia > 0 ? "Conciliación positiva" : "Conciliación negativa", familia: "Conciliación", tipo: diferencia > 0 ? "ingreso" : "egreso", grupo: diferencia > 0 ? null : "variable", naturaleza }).select("id").single();
    if (error) throw new Error(error.message); id = data.id;
  }
  const { error } = await db.from("transacciones").insert({ user_id: user.id, categoria_id: id, cuenta_id: cuentaId, naturaleza, monto: Math.abs(diferencia), descripcion: motivo.trim(), metodo_pago: cuenta.metodo_pago, fecha: hoyISOEnMexico() });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard"); return { diferencia };
}
