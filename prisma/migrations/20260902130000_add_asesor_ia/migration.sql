-- Agrega el Asesor IA: historial de chat con memoria persistente por usuario.
-- Mismo patrón de RLS que el resto del esquema (auth.uid() = user_id). Sin
-- tabla de "hilos": este asesor es un solo hilo continuo por usuario (uso
-- personal, no multi-sesión), así que user_id ya identifica el hilo completo.

-- ========================================================= mensajes_asesor
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
