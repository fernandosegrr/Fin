-- Agrega una función de agregación en base de datos para el saldo histórico
-- acumulado por método de pago (efectivo/tarjeta). Reemplaza el cálculo
-- anterior, que traía a Node CADA transacción y traspaso histórico y los
-- sumaba en JS: por encima de las ~1000 filas que Supabase devuelve por
-- defecto en una consulta normal (max-rows de PostgREST), el saldo empezaba
-- a salir mal en silencio. Esta función suma con SUM()/FILTER dentro de
-- Postgres, así que no hay límite de filas ni transferencia de datos de más.
--
-- SECURITY INVOKER (el default) + filtra por auth.uid() directamente: corre
-- con los privilegios de quien llama, así que respeta exactamente el mismo
-- límite que las políticas RLS ya imponen sobre estas tablas.
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
