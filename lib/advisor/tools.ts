import { esFechaISO } from "@/lib/dates";
import { aNumero, formatearMonto } from "@/lib/format";
import { patronBusqueda, valorLogico } from "@/lib/search";
import { crearCliente } from "@/lib/dashboard/clients";
import { actualizarTransaccion, crearTransaccion, eliminarTransaccion } from "@/lib/dashboard/transactions";
import { obtenerCategorias } from "@/lib/dashboard/categories";
import { esErrorEsquemaClientes } from "@/lib/dashboard/shared";
import { MAX_NOTAS_MEMORIA } from "./config";
import { sanitizarDato } from "./utils";
import type { SupabaseServerClient } from "./types";
import type { Categoria, MetodoPago, TransaccionConCategoria } from "@/lib/types";

function resolverCategoriaPorNombre(categorias: Categoria[], nombreBuscado: string, tipo?: "ingreso" | "egreso" | null) {
  const candidatas = tipo ? categorias.filter((c) => c.tipo === tipo) : categorias;
  const norm = nombreBuscado.toLocaleLowerCase("es-MX");
  const exacta = candidatas.find((c) => c.nombre.toLocaleLowerCase("es-MX") === norm);
  const parciales = candidatas.filter(
    (c) =>
      c.nombre.toLocaleLowerCase("es-MX").includes(norm) ||
      norm.includes(c.nombre.toLocaleLowerCase("es-MX")),
  );
  const categoria = exacta ?? (parciales.length === 1 ? parciales[0] : null);
  return { categoria, parciales, candidatas };
}

function limpiarId(idCrudo: unknown): string {
  if (typeof idCrudo !== "string") return "";
  return idCrudo.trim().replace(/^id:/i, "").trim();
}

export async function ejecutarGuardarNotaMemoria(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<string> {
  let contenido = "";
  try {
    const parsed: unknown = JSON.parse(argumentosCrudos);
    if (typeof (parsed as { contenido?: unknown })?.contenido === "string") {
      contenido = (parsed as { contenido: string }).contenido.trim();
    }
  } catch {
    return "Error: argumentos inválidos, no se guardó nada.";
  }

  if (!contenido) return "Error: contenido vacío o inválido, no se guardó nada.";
  if (contenido.length > 500) return "Error: la nota es demasiado larga (máx. 500 caracteres), no se guardó.";

  const { data: existentes, error: errorExistentes } = await supabase
    .from("notas_memoria_asesor")
    .select("id, contenido, creado_en")
    .eq("user_id", userId)
    .order("creado_en", { ascending: true });
  if (errorExistentes) {
    console.error("Error leyendo notas de memoria:", errorExistentes);
    return "Error: no se pudo guardar la nota.";
  }

  const notas = existentes ?? [];
  const contenidoNorm = contenido.toLocaleLowerCase("es-MX");
  if (notas.some((n) => String(n.contenido).toLocaleLowerCase("es-MX") === contenidoNorm)) {
    return "Esa nota ya estaba guardada; no se duplicó.";
  }

  if (notas.length >= MAX_NOTAS_MEMORIA) {
    const sobran = notas.length - MAX_NOTAS_MEMORIA + 1;
    const idsViejas = notas.slice(0, sobran).map((n) => n.id as string);
    const { error: errorPrune } = await supabase.from("notas_memoria_asesor").delete().in("id", idsViejas);
    if (errorPrune) {
      console.error("Error recortando notas de memoria:", errorPrune);
      return "Error: no se pudo guardar la nota (memoria llena).";
    }
  }

  const { error } = await supabase.from("notas_memoria_asesor").insert({ user_id: userId, contenido });
  if (error) {
    console.error("Error guardando nota de memoria:", error);
    return "Error: no se pudo guardar la nota.";
  }
  return "Nota guardada correctamente.";
}

export async function ejecutarRegistrarMovimiento(argumentosCrudos: string): Promise<{ texto: string; modificado: boolean }> {
  let parsed: {
    tipo?: unknown;
    monto?: unknown;
    categoria?: unknown;
    metodo_pago?: unknown;
    descripcion?: unknown;
    fecha?: unknown;
    cliente?: unknown;
  };
  try {
    parsed = JSON.parse(argumentosCrudos) as typeof parsed;
  } catch {
    return { texto: "Error: argumentos inválidos, no se registró nada.", modificado: false };
  }

  const tipo = parsed.tipo === "ingreso" || parsed.tipo === "egreso" ? parsed.tipo : null;
  const monto = typeof parsed.monto === "number" ? parsed.monto : Number(parsed.monto);
  const nombreCat = typeof parsed.categoria === "string" ? parsed.categoria.trim() : "";
  const metodo = parsed.metodo_pago === "efectivo" || parsed.metodo_pago === "tarjeta" ? parsed.metodo_pago : null;
  const descripcion = typeof parsed.descripcion === "string" ? parsed.descripcion.trim() : "";
  const fecha = typeof parsed.fecha === "string" ? parsed.fecha.trim() : "";
  const nombreCliente = typeof parsed.cliente === "string" ? parsed.cliente.trim() : "";

  if (!tipo) return { texto: "Error: el tipo debe ser ingreso o egreso.", modificado: false };
  if (!Number.isFinite(monto) || monto <= 0) return { texto: "Error: el monto debe ser mayor a 0.", modificado: false };
  if (monto > 1_000_000) return { texto: "Error: el monto es demasiado grande. Confírmalo con el usuario.", modificado: false };
  if (!metodo) return { texto: "Error: el método de pago debe ser efectivo o tarjeta.", modificado: false };
  if (!nombreCat) return { texto: "Error: indica una categoría.", modificado: false };
  if (fecha && !esFechaISO(fecha)) return { texto: "Error: la fecha debe ser YYYY-MM-DD.", modificado: false };

  const categorias = await obtenerCategorias();
  const { categoria, parciales, candidatas } = resolverCategoriaPorNombre(categorias, nombreCat, tipo);
  if (!categoria) {
    const lista = candidatas.map((c) => c.nombre).join(", ") || "(no hay categorías de este tipo)";
    if (parciales.length > 1) {
      return {
        texto: `Error: hay varias categorías parecidas (${parciales.map((c) => c.nombre).join(", ")}). Pregunta cuál usar.`,
        modificado: false,
      };
    }
    return {
      texto: `Error: no encontré la categoría "${nombreCat}" de tipo ${tipo}. Disponibles: ${lista}.`,
      modificado: false,
    };
  }

  let clienteId: string | null = null;
  if (tipo === "ingreso" && nombreCliente) {
    const creado = await crearCliente(nombreCliente);
    clienteId = creado.id;
  }

  try {
    await crearTransaccion({
      categoria_id: categoria.id,
      monto,
      descripcion: descripcion || null,
      metodo_pago: metodo,
      fecha: fecha || undefined,
      cliente_id: clienteId,
    });
  } catch (err) {
    return { texto: `Error al guardar: ${err instanceof Error ? err.message : "falló el registro"}`, modificado: false };
  }

  return {
    texto: `Movimiento registrado: ${tipo} de ${formatearMonto(monto)} en ${categoria.nombre} (${metodo})${descripcion ? ` — ${descripcion}` : ""}${nombreCliente ? ` · cliente ${nombreCliente}` : ""}.`,
    modificado: true,
  };
}

export async function ejecutarConsultarMovimientos(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<string> {
  let parsed: {
    busqueda?: unknown;
    tipo?: unknown;
    metodo_pago?: unknown;
    categoria?: unknown;
    fecha_inicio?: unknown;
    fecha_fin?: unknown;
    orden?: unknown;
    limite?: unknown;
  } = {};
  try {
    parsed = (JSON.parse(argumentosCrudos || "{}") as typeof parsed) ?? {};
  } catch {
    return "Error: argumentos inválidos para consultar_movimientos.";
  }

  const busqueda = typeof parsed.busqueda === "string" ? parsed.busqueda.trim() : "";
  const tipo = parsed.tipo === "ingreso" || parsed.tipo === "egreso" ? parsed.tipo : null;
  const metodoPago: MetodoPago | null =
    parsed.metodo_pago === "efectivo" || parsed.metodo_pago === "tarjeta" ? parsed.metodo_pago : null;
  const nombreCat = typeof parsed.categoria === "string" ? parsed.categoria.trim() : "";
  const fechaInicio = typeof parsed.fecha_inicio === "string" && esFechaISO(parsed.fecha_inicio.trim()) ? parsed.fecha_inicio.trim() : null;
  const fechaFin = typeof parsed.fecha_fin === "string" && esFechaISO(parsed.fecha_fin.trim()) ? parsed.fecha_fin.trim() : null;
  const ordenMayorMonto = parsed.orden === "mayor_monto";
  const limiteRaw = typeof parsed.limite === "number" ? parsed.limite : Number(parsed.limite);
  const limite = Number.isFinite(limiteRaw) ? Math.min(Math.max(Math.trunc(limiteRaw), 1), 50) : 25;

  const categorias = await obtenerCategorias();
  let idsCategoriasFiltro: string[] | null = null;
  if (nombreCat) {
    const norm = nombreCat.toLocaleLowerCase("es-MX");
    const coincidentes = categorias.filter(
      (c) =>
        (!tipo || c.tipo === tipo) &&
        (c.nombre.toLocaleLowerCase("es-MX").includes(norm) || norm.includes(c.nombre.toLocaleLowerCase("es-MX"))),
    );
    if (coincidentes.length === 0) {
      return `No se encontraron categorías que coincidan con "${nombreCat}".`;
    }
    idsCategoriasFiltro = coincidentes.map((c) => c.id);
  } else if (tipo) {
    idsCategoriasFiltro = categorias.filter((c) => c.tipo === tipo).map((c) => c.id);
  }

  async function ejecutarQuery(conClientes: boolean) {
    const select = conClientes
      ? "*, categoria:categorias(id, nombre, tipo, grupo), cliente:clientes(id, nombre)"
      : "*, categoria:categorias(id, nombre, tipo, grupo)";
    let query = supabase
      .from("transacciones")
      .select(select, { count: "exact" })
      .eq("user_id", userId);

    if (idsCategoriasFiltro) {
      if (idsCategoriasFiltro.length === 0) return { data: [], count: 0, error: null };
      query = query.in("categoria_id", idsCategoriasFiltro);
    }
    if (metodoPago) query = query.eq("metodo_pago", metodoPago);
    if (fechaInicio) query = query.gte("fecha", fechaInicio);
    if (fechaFin) query = query.lte("fecha", fechaFin);

    if (busqueda) {
      const q = patronBusqueda(busqueda);
      const partes = [`descripcion.ilike.${valorLogico(q)}`];
      const normBusqueda = busqueda.toLocaleLowerCase("es-MX");
      const catIds = categorias
        .filter((c) => c.nombre.toLocaleLowerCase("es-MX").includes(normBusqueda))
        .map((c) => valorLogico(c.id));
      if (catIds.length) partes.push(`categoria_id.in.(${catIds.join(",")})`);
      if (conClientes) {
        const clis = await supabase.from("clientes").select("id").ilike("nombre", q);
        if (!clis.error && clis.data?.length) {
          const cliIds = clis.data.map((c) => valorLogico(String(c.id)));
          partes.push(`cliente_id.in.(${cliIds.join(",")})`);
        }
      }
      query = query.or(partes.join(","));
    }

    if (ordenMayorMonto) {
      query = query.order("monto", { ascending: false }).order("fecha", { ascending: false });
    } else {
      query = query.order("fecha", { ascending: false }).order("creado_en", { ascending: false });
    }

    return query.limit(limite);
  }

  let res = await ejecutarQuery(true);
  if (res.error && esErrorEsquemaClientes(res.error.message)) {
    res = await ejecutarQuery(false);
  }
  if (res.error) {
    return `Error al consultar movimientos: ${res.error.message}`;
  }

  const filas = (res.data ?? []) as unknown as TransaccionConCategoria[];
  const totalEncontrados = res.count ?? filas.length;
  if (filas.length === 0) {
    return "No se encontraron compras ni movimientos con esos criterios.";
  }

  const sumaMuestra = filas.reduce((acc, t) => acc + aNumero(t.monto), 0);
  const lineas = filas.map((t) => {
    const tipoMov = t.categoria?.tipo === "ingreso" ? "Ingreso" : "Egreso";
    const cat = t.categoria?.nombre ? sanitizarDato(t.categoria.nombre, 50) : "Sin categoría";
    const det = t.descripcion ? `"${sanitizarDato(t.descripcion, 120)}"` : "(sin descripción)";
    const cli = t.cliente?.nombre ? ` · cliente: ${sanitizarDato(t.cliente.nombre, 50)}` : "";
    return `- [${t.fecha}] ${tipoMov} ${formatearMonto(aNumero(t.monto))} | ${cat} | ${t.metodo_pago ?? "tarjeta"} | Detalle: ${det}${cli} | id:${t.id}`;
  });

  return `Resultados: mostrando ${filas.length} de ${totalEncontrados} movimientos (suma de los mostrados: ${formatearMonto(sumaMuestra)}):\n${lineas.join("\n")}`;
}

export async function ejecutarEditarMovimiento(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<{ texto: string; modificado: boolean }> {
  let parsed: {
    id?: unknown;
    monto?: unknown;
    categoria?: unknown;
    metodo_pago?: unknown;
    descripcion?: unknown;
    fecha?: unknown;
  };
  try {
    parsed = JSON.parse(argumentosCrudos) as typeof parsed;
  } catch {
    return { texto: "Error: argumentos inválidos para editar_movimiento.", modificado: false };
  }

  const id = limpiarId(parsed.id);
  if (!id) return { texto: "Error: falta el id del movimiento a editar.", modificado: false };

  const { data: actual, error: errorLectura } = await supabase
    .from("transacciones")
    .select("id, categoria_id, monto, descripcion, metodo_pago, fecha, cliente_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (errorLectura || !actual) {
    return { texto: `Error: no encontré un movimiento con id "${id}".`, modificado: false };
  }

  let nuevaCategoriaId = actual.categoria_id as string;
  let nombreCategoriaFinal = "";
  const categorias = await obtenerCategorias();
  const catActual = categorias.find((c) => c.id === nuevaCategoriaId);
  nombreCategoriaFinal = catActual?.nombre ?? "Categoría";

  if (typeof parsed.categoria === "string" && parsed.categoria.trim()) {
    const { categoria, parciales } = resolverCategoriaPorNombre(categorias, parsed.categoria.trim(), null);
    if (!categoria) {
      if (parciales.length > 1) {
        return {
          texto: `Error: hay varias categorías parecidas (${parciales.map((c) => c.nombre).join(", ")}). Pregunta cuál usar.`,
          modificado: false,
        };
      }
      return { texto: `Error: no encontré la categoría "${parsed.categoria.trim()}".`, modificado: false };
    }
    nuevaCategoriaId = categoria.id;
    nombreCategoriaFinal = categoria.nombre;
  }

  const nuevoMonto =
    parsed.monto !== undefined && parsed.monto !== null
      ? typeof parsed.monto === "number"
        ? parsed.monto
        : Number(parsed.monto)
      : aNumero(actual.monto as number | string);

  if (!Number.isFinite(nuevoMonto) || nuevoMonto <= 0) {
    return { texto: "Error: el nuevo monto debe ser mayor a 0.", modificado: false };
  }

  const nuevoMetodo: MetodoPago =
    parsed.metodo_pago === "efectivo" || parsed.metodo_pago === "tarjeta"
      ? parsed.metodo_pago
      : (actual.metodo_pago as MetodoPago) ?? "tarjeta";

  const nuevaDescripcion =
    typeof parsed.descripcion === "string" ? parsed.descripcion.trim() || null : (actual.descripcion as string | null);

  const nuevaFecha = typeof parsed.fecha === "string" && parsed.fecha.trim() ? parsed.fecha.trim() : (actual.fecha as string);
  if (!esFechaISO(nuevaFecha)) {
    return { texto: "Error: la fecha debe tener formato YYYY-MM-DD.", modificado: false };
  }

  try {
    await actualizarTransaccion(id, {
      categoria_id: nuevaCategoriaId,
      monto: nuevoMonto,
      descripcion: nuevaDescripcion,
      metodo_pago: nuevoMetodo,
      fecha: nuevaFecha,
      cliente_id: (actual.cliente_id as string | null) ?? null,
    });
  } catch (err) {
    return {
      texto: `Error al actualizar el movimiento: ${err instanceof Error ? err.message : "falló la edición"}`,
      modificado: false,
    };
  }

  return {
    texto: `Movimiento actualizado (id:${id}): ${formatearMonto(nuevoMonto)} en ${nombreCategoriaFinal} (${nuevoMetodo}) con fecha ${nuevaFecha}${nuevaDescripcion ? ` — "${nuevaDescripcion}"` : ""}.`,
    modificado: true,
  };
}

export async function ejecutarEliminarMovimiento(
  supabase: SupabaseServerClient,
  userId: string,
  argumentosCrudos: string,
): Promise<{ texto: string; modificado: boolean }> {
  let parsed: { id?: unknown };
  try {
    parsed = JSON.parse(argumentosCrudos) as typeof parsed;
  } catch {
    return { texto: "Error: argumentos inválidos para eliminar_movimiento.", modificado: false };
  }

  const id = limpiarId(parsed.id);
  if (!id) return { texto: "Error: falta el id del movimiento a eliminar.", modificado: false };

  const { data: actual } = await supabase
    .from("transacciones")
    .select("id, monto, descripcion, fecha, metodo_pago")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!actual) {
    return { texto: `Error: no encontré ningún movimiento con id "${id}".`, modificado: false };
  }

  try {
    await eliminarTransaccion(id);
  } catch (err) {
    return {
      texto: `Error al eliminar el movimiento: ${err instanceof Error ? err.message : "falló el borrado"}`,
      modificado: false,
    };
  }

  return {
    texto: `Movimiento eliminado correctamente: ${formatearMonto(aNumero(actual.monto as number | string))} del ${actual.fecha as string}${actual.descripcion ? ` ("${actual.descripcion as string}")` : ""}.`,
    modificado: true,
  };
}

