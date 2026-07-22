-- Schema de NexFin Pro — correr en Supabase Dashboard → SQL Editor.
-- Ejecuta este script completo en una base de datos nueva.
-- Si ya tienes tablas, usa los bloques "alter table ... add column if not exists".

-- ─────────────────────────────────────────────────────────── ENUMS
create type if not exists tipo_categoria as enum ('ingreso', 'egreso');
create type if not exists grupo_categoria as enum ('fijo', 'variable');

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

create trigger if not exists presupuestos_rechazar_ingreso
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
