-- Schema de Finanzas — correr en Supabase Dashboard → SQL Editor.

create type tipo_categoria as enum ('ingreso', 'egreso');
create type grupo_categoria as enum ('fijo', 'variable');

-- ============================================================= categorias
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id),
  nombre     text not null,
  tipo       tipo_categoria not null,
  grupo      grupo_categoria,
  constraint grupo_solo_en_egreso check (
    (tipo = 'ingreso' and grupo is null) or
    (tipo = 'egreso' and grupo is not null)
  )
);

create index categorias_user_tipo_idx on public.categorias (user_id, tipo);

alter table public.categorias enable row level security;

create policy "categorias_por_usuario" on public.categorias
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================== transacciones
create table public.transacciones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id),
  categoria_id uuid not null references public.categorias (id),
  monto        numeric not null check (monto > 0),
  fecha        date not null,
  metodo_pago  text default 'tarjeta',
  descripcion  text,
  creado_en    timestamptz not null default now()
);

-- Si la tabla ya existe, agregar la columna metodo_pago:
alter table public.transacciones add column if not exists metodo_pago text default 'tarjeta';

create index transacciones_user_fecha_idx on public.transacciones (user_id, fecha desc);

alter table public.transacciones enable row level security;

create policy "transacciones_por_usuario" on public.transacciones
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================ presupuestos
create table public.presupuestos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id),
  categoria_id  uuid not null references public.categorias (id),
  monto_limite  numeric not null,
  mes           date not null
);

create index presupuestos_user_mes_idx on public.presupuestos (user_id, mes);

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

create trigger presupuestos_rechazar_ingreso
  before insert or update on public.presupuestos
  for each row execute function public.rechazar_presupuesto_ingreso();
