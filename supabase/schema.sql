-- Schema de NexFin Pro — correr en Supabase Dashboard → SQL Editor.
-- Ejecuta este script completo en una base de datos nueva.
-- Si ya tienes tablas, usa los bloques "alter table ... add column if not exists".

-- ─────────────────────────────────────────────────────────── ENUMS
-- `create type` no soporta `if not exists` en Postgres (a diferencia de
-- `create table`/`create index`) — este script es para una base NUEVA, así
-- que no hace falta esa guarda aquí.
create type tipo_categoria as enum ('ingreso', 'egreso');
create type grupo_categoria as enum ('fijo', 'variable');

-- ================================================================ categorias
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  nombre     text not null,
  tipo       tipo_categoria not null,
  grupo      grupo_categoria,
  constraint grupo_solo_en_egreso check (
    (tipo = 'ingreso' and grupo is null) or
    (tipo = 'egreso' and grupo is not null)
  )
);

create index if not exists categorias_user_tipo_idx on public.categorias (user_id, tipo);

alter table public.categorias enable row level security;

create policy "categorias_por_usuario" on public.categorias
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================= transacciones
create table if not exists public.transacciones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  monto        numeric not null check (monto > 0),
  fecha        date not null default current_date,
  metodo_pago  text not null default 'tarjeta' check (metodo_pago in ('tarjeta', 'efectivo')),
  descripcion  text,
  creado_en    timestamptz not null default now()
);

-- Migración segura: añadir columna si no existe
alter table public.transacciones add column if not exists metodo_pago text not null default 'tarjeta';

-- Índice compuesto optimizado para joins frecuentes (user_id + fecha + categoria_id)
create index if not exists transacciones_user_fecha_idx    on public.transacciones (user_id, fecha desc);
create index if not exists transacciones_user_cat_idx      on public.transacciones (user_id, categoria_id);

alter table public.transacciones enable row level security;

create policy "transacciones_por_usuario" on public.transacciones
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================== presupuestos
create table if not exists public.presupuestos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  categoria_id  uuid not null references public.categorias (id) on delete cascade,
  monto_limite  numeric not null check (monto_limite > 0),
  mes           date not null,
  unique (user_id, categoria_id, mes)
);

create index if not exists presupuestos_user_mes_idx on public.presupuestos (user_id, mes);

alter table public.presupuestos enable row level security;

create policy "presupuestos_por_usuario" on public.presupuestos
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Rechaza presupuestos sobre categorías de tipo 'ingreso'.
create or replace function public.rechazar_presupuesto_ingreso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.categorias
    where id = new.categoria_id and tipo = 'ingreso'
  ) then
    raise exception 'No se puede crear un presupuesto para una categoría de tipo ingreso';
  end if;
  return new;
end;
$$;

-- `create trigger` tampoco soporta `if not exists` (sí existe `create or
-- replace trigger` desde Postgres 14, pero un trigger nuevo no lo necesita).
create trigger presupuestos_rechazar_ingreso
  before insert or update on public.presupuestos
  for each row execute function public.rechazar_presupuesto_ingreso();

-- ========================================================= gastos_recurrentes
-- Tabla nueva: gastos/suscripciones recurrentes por usuario.
-- Reemplaza el almacenamiento en localStorage del cliente.
create table if not exists public.gastos_recurrentes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  nombre       text not null,
  monto        numeric not null check (monto > 0),
  dia_cobro    integer not null check (dia_cobro between 1 and 31),
  categoria_id uuid references public.categorias (id) on delete set null,
  metodo_pago  text not null default 'tarjeta' check (metodo_pago in ('tarjeta', 'efectivo')),
  creado_en    timestamptz not null default now()
);

create index if not exists gastos_recurrentes_user_idx on public.gastos_recurrentes (user_id, dia_cobro);

alter table public.gastos_recurrentes enable row level security;

create policy "gastos_recurrentes_por_usuario" on public.gastos_recurrentes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Vincula cada transacción con la suscripción que la generó (si aplica), para
-- poder saber con certeza —consultando la BD, no memoria del navegador— si una
-- suscripción ya se cobró este mes. Va después de gastos_recurrentes porque
-- depende de esa tabla. on delete set null: borrar la suscripción no borra el
-- historial de cobros ya registrados.
alter table public.transacciones add column if not exists gasto_recurrente_id uuid references public.gastos_recurrentes (id) on delete set null;

create index if not exists transacciones_gasto_recurrente_idx on public.transacciones (gasto_recurrente_id);

-- ========================================================== transferencias
-- Traspasos de dinero entre Efectivo y Tarjeta/Banco. No son ingreso ni egreso
-- real (el patrimonio total no cambia), por eso viven en su propia tabla y no
-- afectan los totales de ingresos/egresos ni los presupuestos por categoría.
create table if not exists public.transferencias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  monto       numeric not null check (monto > 0),
  origen      text not null check (origen in ('tarjeta', 'efectivo')),
  destino     text not null check (destino in ('tarjeta', 'efectivo')),
  fecha       date not null default current_date,
  descripcion text,
  creado_en   timestamptz not null default now(),
  constraint origen_distinto_destino check (origen <> destino)
);

create index if not exists transferencias_user_fecha_idx on public.transferencias (user_id, fecha desc);

alter table public.transferencias enable row level security;

create policy "transferencias_por_usuario" on public.transferencias
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================== calcular_saldo_historico()
-- Suma TODO el historial de transacciones + traspasos anteriores a una fecha,
-- separado por método de pago, agregando dentro de Postgres (SUM/FILTER) en
-- vez de traer cada fila a Node — así no hay techo de filas (PostgREST limita
-- las consultas normales a ~1000 filas por defecto). SECURITY INVOKER
-- (default) + filtro por auth.uid(): respeta el mismo límite que ya imponen
-- las políticas RLS de arriba.
create or replace function public.calcular_saldo_historico(p_fecha_limite date)
returns table (efectivo numeric, tarjeta numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with movimientos as (
    select
      t.metodo_pago as metodo,
      case when c.tipo = 'ingreso' then t.monto else -t.monto end as delta
    from public.transacciones t
    join public.categorias c on c.id = t.categoria_id
    where t.user_id = auth.uid() and t.fecha < p_fecha_limite

    union all

    select origen as metodo, -monto as delta
    from public.transferencias
    where user_id = auth.uid() and fecha < p_fecha_limite

    union all

    select destino as metodo, monto as delta
    from public.transferencias
    where user_id = auth.uid() and fecha < p_fecha_limite
  )
  select
    coalesce(sum(delta) filter (where metodo = 'efectivo'), 0)::numeric as efectivo,
    coalesce(sum(delta) filter (where metodo = 'tarjeta'), 0)::numeric as tarjeta
  from movimientos;
$$;

grant execute on function public.calcular_saldo_historico(date) to authenticated;

-- ========================================================= mensajes_asesor
-- Historial de chat del Asesor IA. Un solo hilo continuo por usuario (uso
-- personal, no multi-sesión) — user_id ya identifica el hilo completo.
create table if not exists public.mensajes_asesor (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  rol            text not null check (rol in ('usuario', 'asistente')),
  contenido      text not null,
  tokens_entrada integer,
  tokens_salida  integer,
  creado_en      timestamptz not null default now()
);

create index if not exists mensajes_asesor_user_creado_idx on public.mensajes_asesor (user_id, creado_en);

alter table public.mensajes_asesor enable row level security;

create policy "mensajes_asesor_por_usuario" on public.mensajes_asesor
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==================================================== notas_memoria_asesor
-- Hechos/preferencias que el asesor decide recordar a largo plazo (p. ej.
-- "quiere ahorrar para un coche en 2027"), vía la tool guardar_nota_memoria.
-- Se inyectan como lista en el system prompt en cada mensaje, en vez de
-- reenviar el historial completo — mucho más barato en tokens que "memoria"
-- que crece indefinidamente.
create table if not exists public.notas_memoria_asesor (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  contenido text not null,
  creado_en timestamptz not null default now()
);

create index if not exists notas_memoria_asesor_user_creado_idx on public.notas_memoria_asesor (user_id, creado_en);

alter table public.notas_memoria_asesor enable row level security;

create policy "notas_memoria_asesor_por_usuario" on public.notas_memoria_asesor
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
