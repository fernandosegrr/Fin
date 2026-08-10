-- BASELINE — describe el esquema que YA existe en producción (creado antes de
-- adoptar Prisma, corriendo secciones de supabase/schema.sql a mano según
-- cada feature se fue agregando). No se ejecuta contra la base de datos real:
-- se marca como aplicada con
--
--   npx prisma migrate resolve --applied 20260810120000_baseline
--
-- para que Prisma la use como punto de partida y solo migraciones nuevas
-- (como la siguiente, 20260810120100_add_saldo_historico_rpc) se apliquen de
-- verdad. Si alguna vez se necesita levantar una base de datos NUEVA desde
-- cero, usa supabase/schema.sql (más simple de pegar en el SQL Editor) — este
-- archivo existe para que `prisma migrate` tenga un historial consistente
-- sobre el que seguir generando diffs, no como script de setup.

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

alter table public.transacciones add column if not exists metodo_pago text not null default 'tarjeta';

create index if not exists transacciones_user_fecha_idx on public.transacciones (user_id, fecha desc);
create index if not exists transacciones_user_cat_idx   on public.transacciones (user_id, categoria_id);

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

create trigger presupuestos_rechazar_ingreso
  before insert or update on public.presupuestos
  for each row execute function public.rechazar_presupuesto_ingreso();

-- ========================================================= gastos_recurrentes
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

alter table public.transacciones add column if not exists gasto_recurrente_id uuid references public.gastos_recurrentes (id) on delete set null;

create index if not exists transacciones_gasto_recurrente_idx on public.transacciones (gasto_recurrente_id);

-- ========================================================== transferencias
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
