-- Garantía atómica incluso si dos dispositivos intentan registrar a la vez.
-- Si ya hay duplicados, el índice falla sin borrar ni modificar movimientos.
do $$
begin
  if exists (
    select 1 from public.transacciones
    where gasto_recurrente_id is not null
    group by user_id, gasto_recurrente_id, extract(year from fecha), extract(month from fecha)
    having count(*) > 1
  ) then
    raise exception 'Hay pagos recurrentes duplicados en un mismo mes. Revisa los movimientos antes de activar la protección; no se ha borrado ningún dato.';
  end if;
end $$;

create unique index if not exists transacciones_recurrente_mes_unico
on public.transacciones (
  user_id,
  gasto_recurrente_id,
  (extract(year from fecha)),
  (extract(month from fecha))
)
where gasto_recurrente_id is not null;
