-- Clientes/proyectos para etiquetar ingresos, y una meta de ahorro por usuario.
-- cliente_id en transacciones es opcional (on delete set null: borrar el
-- cliente no borra el historial de cobros).

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  nombre     text not null,
  creado_en  timestamptz not null default now(),
  unique (user_id, nombre)
);

create index if not exists clientes_user_idx on public.clientes (user_id, nombre);

alter table public.clientes enable row level security;

drop policy if exists "clientes_por_usuario" on public.clientes;
create policy "clientes_por_usuario" on public.clientes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.transacciones
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

create index if not exists transacciones_cliente_idx on public.transacciones (cliente_id);

create table if not exists public.metas_ahorro (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  nombre         text not null,
  monto_objetivo numeric not null check (monto_objetivo > 0),
  fecha_limite   date,
  creado_en      timestamptz not null default now()
);

alter table public.metas_ahorro enable row level security;

drop policy if exists "metas_ahorro_por_usuario" on public.metas_ahorro;
create policy "metas_ahorro_por_usuario" on public.metas_ahorro
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
