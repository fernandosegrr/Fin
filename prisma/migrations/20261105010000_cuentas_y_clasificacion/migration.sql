-- Ampliación compatible: el tipo de categoría conserva el sentido histórico;
-- naturaleza y cuentas describen el efecto económico de cada movimiento.
create table public.cuentas_financieras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  tipo text not null check (tipo in ('efectivo','principal','ahorro','reserva')),
  metodo_pago text not null check (metodo_pago in ('efectivo','tarjeta')),
  banco text,
  excluida_disponible boolean not null default false,
  archivada boolean not null default false,
  grupo_rendimiento text,
  rendimiento_desde date,
  tasa_anual numeric(8,4) not null default 0 check (tasa_anual between 0 and 100),
  tasa_excedente numeric(8,4) not null default 0 check (tasa_excedente between 0 and 100),
  tasa_superior numeric(8,4) not null default 0 check (tasa_superior between 0 and 100),
  retencion_anual numeric(8,4) not null default 0 check (retencion_anual between 0 and 100),
  limite_preferente numeric not null default 25000 check (limite_preferente >= 0),
  limite_segundo_tramo numeric not null default 1000000 check (limite_segundo_tramo >= limite_preferente),
  plan text,
  creado_en timestamptz not null default now(),
  unique(user_id,codigo), unique(id,user_id)
);
alter table public.cuentas_financieras enable row level security;
create policy cuentas_por_usuario on public.cuentas_financieras for all
  using (auth.uid()=user_id) with check (auth.uid()=user_id);

alter table public.categorias
  add column familia text,
  add column archivada boolean not null default false,
  add column aliases text[] not null default '{}',
  add column naturaleza text;
alter table public.transacciones
  add column naturaleza text,
  add column cuenta_id uuid,
  add column cuenta_destino_id uuid,
  add column etiquetas text[] not null default '{}',
  add column requiere_revision boolean not null default false,
  add column motivo_revision text,
  add column interes_bruto numeric,
  add column impuesto_retenido numeric,
  add column deuda_liquidada_en date,
  add column movimiento_relacionado_id uuid references public.transacciones(id),
  add column eliminado_en timestamptz,
  add column clave_solicitud uuid,
  add column actualizado_en timestamptz not null default now();
alter table public.transferencias
  add column cuenta_origen_id uuid,
  add column cuenta_destino_id uuid,
  add column eliminado_en timestamptz,
  add column clave_solicitud uuid,
  add column actualizado_en timestamptz not null default now();
alter table public.metas_ahorro add column cuenta_id uuid;

insert into public.cuentas_financieras(user_id,codigo,nombre,tipo,metodo_pago,excluida_disponible)
select u.id,v.codigo,v.nombre,v.tipo,v.metodo,v.reserva from auth.users u cross join
  (values ('efectivo','Efectivo','efectivo','efectivo',false),
          ('principal','Dinero principal','principal','tarjeta',false),
          ('ahorro','Mi ahorro','ahorro','tarjeta',true)) v(codigo,nombre,tipo,metodo,reserva)
on conflict(user_id,codigo) do nothing;

update public.transacciones t set cuenta_id=c.id,naturaleza=cat.tipo::text
from public.cuentas_financieras c,public.categorias cat
where c.user_id=t.user_id and c.codigo=case when t.metodo_pago='efectivo' then 'efectivo' else 'principal' end and cat.id=t.categoria_id;
update public.transferencias t set cuenta_origen_id=a.id,cuenta_destino_id=b.id
from public.cuentas_financieras a,public.cuentas_financieras b
where a.user_id=t.user_id and b.user_id=t.user_id
  and a.codigo=case when t.origen='efectivo' then 'efectivo' else 'principal' end
  and b.codigo=case when t.destino='efectivo' then 'efectivo' else 'principal' end;

alter table public.transacciones add constraint naturaleza_valida check (naturaleza in
 ('ingreso','egreso','apoyo','rendimiento','retencion','reembolso','financiacion','pago_deuda','ajuste_entrada','ajuste_salida','traspaso','ingreso_pendiente','egreso_pendiente'));
alter table public.categorias add constraint categoria_naturaleza_valida check (naturaleza is null or naturaleza in
 ('ingreso','egreso','apoyo','rendimiento','retencion','reembolso','financiacion','pago_deuda','ajuste_entrada','ajuste_salida','traspaso','ingreso_pendiente','egreso_pendiente'));
alter table public.transacciones add constraint cuenta_propietario_fk foreign key(cuenta_id,user_id) references public.cuentas_financieras(id,user_id);
alter table public.transacciones add constraint destino_propietario_fk foreign key(cuenta_destino_id,user_id) references public.cuentas_financieras(id,user_id);
alter table public.transferencias add constraint origen_propietario_fk foreign key(cuenta_origen_id,user_id) references public.cuentas_financieras(id,user_id);
alter table public.transferencias add constraint destino_propietario_fk foreign key(cuenta_destino_id,user_id) references public.cuentas_financieras(id,user_id);
alter table public.metas_ahorro add constraint meta_cuenta_propietario_fk foreign key(cuenta_id,user_id) references public.cuentas_financieras(id,user_id);
alter table public.transferencias drop constraint if exists origen_distinto_destino;
alter table public.transferencias add constraint cuentas_distintas check (cuenta_origen_id <> cuenta_destino_id);
alter table public.transacciones add constraint destino_solo_traspaso check
 ((naturaleza='traspaso' and cuenta_destino_id is not null and cuenta_destino_id<>cuenta_id) or (naturaleza<>'traspaso' and cuenta_destino_id is null));
alter table public.transacciones add constraint rendimiento_importes_validos check
 ((interes_bruto is null or interes_bruto>=0) and (impuesto_retenido is null or impuesto_retenido>=0)
 and (interes_bruto is null or impuesto_retenido is null or (naturaleza='rendimiento' and monto=interes_bruto-impuesto_retenido)));
create unique index transaccion_solicitud_unica on public.transacciones(user_id,clave_solicitud) where clave_solicitud is not null;
create unique index transferencia_solicitud_unica on public.transferencias(user_id,clave_solicitud) where clave_solicitud is not null;
create index transacciones_cuenta_fecha on public.transacciones(user_id,cuenta_id,fecha) where eliminado_en is null;
create index transacciones_revision on public.transacciones(user_id,requiere_revision) where eliminado_en is null;
drop index if exists public.transacciones_recurrente_mes_unico;
create unique index transacciones_recurrente_mes_unico on public.transacciones
  (user_id,gasto_recurrente_id,(extract(year from fecha)),(extract(month from fecha)))
  where gasto_recurrente_id is not null and eliminado_en is null;

create or replace function public.asegurar_cuentas_financieras() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into public.cuentas_financieras(user_id,codigo,nombre,tipo,metodo_pago,excluida_disponible)
  values (auth.uid(),'efectivo','Efectivo','efectivo','efectivo',false),
         (auth.uid(),'principal','Dinero principal','principal','tarjeta',false),
         (auth.uid(),'ahorro','Mi ahorro','ahorro','tarjeta',true)
  on conflict(user_id,codigo) do nothing;
end $$;
revoke all on function public.asegurar_cuentas_financieras() from public;
grant execute on function public.asegurar_cuentas_financieras() to authenticated;

create or replace function public.validar_movimiento_financiero() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare cat public.categorias;
begin
  if tg_table_name='transacciones' then
    select * into cat from public.categorias where id=new.categoria_id and user_id=new.user_id;
    if not found then raise exception 'La categoría no pertenece al usuario'; end if;
    new.naturaleza:=coalesce(new.naturaleza,cat.naturaleza,cat.tipo::text);
    if new.cuenta_id is null then
      select id into new.cuenta_id from public.cuentas_financieras where user_id=new.user_id and codigo=case when new.metodo_pago='efectivo' then 'efectivo' else 'principal' end;
    end if;
    if new.cuenta_id is null then raise exception 'Falta la cuenta del movimiento'; end if;
    if new.cliente_id is not null and not exists(select 1 from public.clientes where id=new.cliente_id and user_id=new.user_id) then raise exception 'El cliente no pertenece al usuario'; end if;
    if new.gasto_recurrente_id is not null and not exists(select 1 from public.gastos_recurrentes where id=new.gasto_recurrente_id and user_id=new.user_id) then raise exception 'El pago recurrente no pertenece al usuario'; end if;
    if new.movimiento_relacionado_id is not null and not exists(select 1 from public.transacciones where id=new.movimiento_relacionado_id and user_id=new.user_id) then raise exception 'El movimiento relacionado no pertenece al usuario'; end if;
  else
    if new.cuenta_origen_id is null then select id into new.cuenta_origen_id from public.cuentas_financieras where user_id=new.user_id and codigo=case when new.origen='efectivo' then 'efectivo' else 'principal' end; end if;
    if new.cuenta_destino_id is null then select id into new.cuenta_destino_id from public.cuentas_financieras where user_id=new.user_id and codigo=case when new.destino='efectivo' then 'efectivo' else 'principal' end; end if;
    if new.cuenta_origen_id is null or new.cuenta_destino_id is null then raise exception 'Faltan las cuentas del traspaso'; end if;
  end if;
  new.actualizado_en:=now();
  return new;
end $$;
create trigger validar_transaccion_financiera before insert or update on public.transacciones for each row execute function public.validar_movimiento_financiero();
create trigger validar_transferencia_financiera before insert or update on public.transferencias for each row execute function public.validar_movimiento_financiero();

create table public.cambios_financieros (
  secuencia bigint generated always as identity primary key,
  id uuid not null default gen_random_uuid() unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  lote_id uuid not null,
  entidad text not null,
  registro_id uuid not null,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);
alter table public.cambios_financieros enable row level security;
create policy cambios_lectura_propietario on public.cambios_financieros for select using(auth.uid()=user_id);
revoke insert,update,delete on public.cambios_financieros from anon,authenticated;

create or replace function public.auditar_cambio_financiero() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare anterior jsonb; posterior jsonb; fila jsonb; lote uuid;
begin
  if tg_op<>'INSERT' then anterior:=to_jsonb(old); end if;
  if tg_op<>'DELETE' then posterior:=to_jsonb(new); end if;
  if (anterior-'actualizado_en') is not distinct from (posterior-'actualizado_en') then return coalesce(new,old); end if;
  fila:=coalesce(posterior,anterior);
  lote:=coalesce(nullif(current_setting('app.lote_financiero',true),'')::uuid,gen_random_uuid());
  insert into public.lotes_financieros(id,user_id,nombre)
  values(lote,(fila->>'user_id')::uuid,case tg_table_name when 'transacciones' then 'Cambio de movimiento' when 'transferencias' then 'Cambio de traspaso' when 'categorias' then 'Cambio de categoría' when 'cuentas_financieras' then 'Cambio de cuenta' when 'presupuestos' then 'Cambio de presupuesto' when 'metas_ahorro' then 'Cambio de meta' else 'Cambio de pago recurrente' end)
  on conflict(id) do nothing;
  insert into public.cambios_financieros(user_id,lote_id,entidad,registro_id,antes,despues)
  values((fila->>'user_id')::uuid,lote,tg_table_name,(fila->>'id')::uuid,anterior,posterior);
  return coalesce(new,old);
end $$;
revoke all on function public.auditar_cambio_financiero() from public;
do $$ declare tabla text; begin
  foreach tabla in array array['cuentas_financieras','categorias','transacciones','transferencias','presupuestos','gastos_recurrentes','metas_ahorro'] loop
    execute format('create trigger auditar_finanzas after insert or update or delete on public.%I for each row execute function public.auditar_cambio_financiero()',tabla);
  end loop;
end $$;

create table public.lotes_financieros (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  revertido boolean not null default false,
  creado_en timestamptz not null default now()
);
alter table public.lotes_financieros enable row level security;
create policy lotes_propietario on public.lotes_financieros for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- Un único commit de datos: comprueba la instantánea y conserva el antes/después.
create or replace function public.aplicar_plan_financiero(p_plan jsonb,p_lote uuid,p_nombre text default 'Reclasificación') returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare elemento jsonb; actual jsonb; tabla text; columnas text; asignaciones text; item_id uuid; afectados int; total int:=0;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if exists(select 1 from public.lotes_financieros where id=p_lote and user_id=auth.uid()) then return jsonb_build_object('repetido',true,'lote_id',p_lote); end if;
  perform set_config('app.lote_financiero',p_lote::text,true);
  insert into public.lotes_financieros(id,user_id,nombre) values(p_lote,auth.uid(),left(p_nombre,120));
  foreach tabla in array array['cuentas_financieras','categorias','transacciones','transferencias','gastos_recurrentes','presupuestos','metas_ahorro'] loop
    for elemento in select value from jsonb_array_elements(coalesce(p_plan->tabla,'[]'::jsonb)) loop
      item_id:=(elemento->'despues'->>'id')::uuid;
      if elemento->'despues'->>'user_id' is distinct from auth.uid()::text then raise exception 'Cuenta ajena en el lote'; end if;
      execute format('select to_jsonb(t) from public.%I t where id=$1 and user_id=$2 for update',tabla) into actual using item_id,auth.uid();
      if elemento ? 'antes' and elemento->'antes'<>'null'::jsonb then
        if actual is null or not(actual @> (elemento->'antes')) then raise exception 'El movimiento % cambió después de la auditoría. Actualiza la revisión.',item_id; end if;
      elsif actual is not null then
        raise exception 'El registro % ya existe; no se sobrescribió.',item_id;
      end if;
      select string_agg(format('%I',key),','),string_agg(format('%1$I=(jsonb_populate_record(null::public.%2$I,$1)).%1$I',key,tabla),',')
        into columnas,asignaciones from jsonb_object_keys(elemento->'despues') key
        where key not in ('id','user_id','creado_en','actualizado_en')
          and exists(select 1 from information_schema.columns where table_schema='public' and table_name=tabla and column_name=key);
      if actual is null then
        select string_agg(format('%I',key),',') into columnas from jsonb_object_keys(elemento->'despues') key
          where exists(select 1 from information_schema.columns where table_schema='public' and table_name=tabla and column_name=key);
        execute format('insert into public.%1$I(%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1)',tabla,columnas) using elemento->'despues';
      else
        execute format('update public.%I set %s where id=$2 and user_id=$3',tabla,asignaciones) using elemento->'despues',item_id,auth.uid();
        get diagnostics afectados=row_count;
        if afectados<>1 then raise exception 'No se pudo actualizar %',item_id; end if;
      end if;
      total:=total+1;
    end loop;
  end loop;
  return jsonb_build_object('lote_id',p_lote,'registros',total,'repetido',false);
end $$;
revoke all on function public.aplicar_plan_financiero(jsonb,uuid,text) from public;
grant execute on function public.aplicar_plan_financiero(jsonb,uuid,text) to authenticated;

create or replace function public.revertir_lote_financiero(p_lote uuid) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare cambio public.cambios_financieros; actual jsonb; asignaciones text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  perform 1 from public.lotes_financieros where id=p_lote and user_id=auth.uid() and not revertido for update;
  if not found then raise exception 'El lote no existe o ya fue revertido'; end if;
  perform set_config('app.lote_financiero',gen_random_uuid()::text,true);
  for cambio in select * from public.cambios_financieros where lote_id=p_lote and user_id=auth.uid() order by secuencia desc loop
    if cambio.entidad not in ('cuentas_financieras','categorias','transacciones','transferencias','gastos_recurrentes','presupuestos','metas_ahorro') then raise exception 'Entidad inválida'; end if;
    execute format('select to_jsonb(t) from public.%I t where id=$1 and user_id=$2 for update',cambio.entidad) into actual using cambio.registro_id,auth.uid();
    if (actual-'actualizado_en') is distinct from (cambio.despues-'actualizado_en') then raise exception 'Hay cambios posteriores en %. No se ha revertido nada.',cambio.registro_id; end if;
    if cambio.antes is null then
      execute format('delete from public.%I where id=$1 and user_id=$2',cambio.entidad) using cambio.registro_id,auth.uid();
    elsif cambio.despues is null then
      execute format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I,$1)',cambio.entidad) using cambio.antes;
    else
      select string_agg(format('%1$I=(jsonb_populate_record(null::public.%2$I,$1)).%1$I',key,cambio.entidad),',') into asignaciones
      from jsonb_object_keys(cambio.antes) key where key not in ('id','user_id','actualizado_en');
      execute format('update public.%I set %s where id=$2 and user_id=$3',cambio.entidad,asignaciones) using cambio.antes,cambio.registro_id,auth.uid();
    end if;
  end loop;
  update public.lotes_financieros set revertido=true where id=p_lote and user_id=auth.uid();
end $$;
revoke all on function public.revertir_lote_financiero(uuid) from public;
grant execute on function public.revertir_lote_financiero(uuid) to authenticated;

create or replace function public.fusionar_categorias_financieras(p_origen uuid,p_destino uuid) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.categorias; b public.categorias; lote uuid:=gen_random_uuid();
begin
  if auth.uid() is null or p_origen=p_destino then raise exception 'Selecciona dos categorías propias distintas'; end if;
  select * into a from public.categorias where id=p_origen and user_id=auth.uid() for update;
  if not found then raise exception 'La categoría de origen no existe'; end if;
  select * into b from public.categorias where id=p_destino and user_id=auth.uid() and not archivada for update;
  if not found or a.tipo<>b.tipo then raise exception 'Selecciona una categoría de destino del mismo tipo'; end if;
  perform set_config('app.lote_financiero',lote::text,true);
  insert into public.lotes_financieros(id,user_id,nombre) values(lote,auth.uid(),'Fusionar categorías');
  update public.transacciones set categoria_id=p_destino where user_id=auth.uid() and categoria_id=p_origen;
  update public.gastos_recurrentes set categoria_id=p_destino where user_id=auth.uid() and categoria_id=p_origen;
  insert into public.presupuestos(user_id,categoria_id,monto_limite,mes)
    select auth.uid(),p_destino,sum(monto_limite),mes from public.presupuestos
    where user_id=auth.uid() and categoria_id in(p_origen,p_destino) group by mes
    on conflict(user_id,categoria_id,mes) do update set monto_limite=excluded.monto_limite;
  delete from public.presupuestos where user_id=auth.uid() and categoria_id=p_origen;
  update public.categorias set aliases=array(select distinct unnest(a.aliases||b.aliases||array[a.nombre])) where id=p_destino and user_id=auth.uid();
  update public.categorias set archivada=true where id=p_origen and user_id=auth.uid();
end $$;
revoke all on function public.fusionar_categorias_financieras(uuid,uuid) from public;
grant execute on function public.fusionar_categorias_financieras(uuid,uuid) to authenticated;

alter table public.mensajes_asesor add column solicitud_id uuid;
create unique index mensajes_solicitud_rol_unicos on public.mensajes_asesor(user_id,solicitud_id,rol) where solicitud_id is not null;
create table public.solicitudes_asesor (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  contenido text not null,
  estado text not null default 'procesando' check(estado in ('procesando','completado','error')),
  acciones jsonb not null default '[]',
  respuesta text,
  mensaje_id uuid references public.mensajes_asesor(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table public.solicitudes_asesor enable row level security;
create policy solicitudes_propietario on public.solicitudes_asesor for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

create or replace function public.validar_categoria_propietario() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.categoria_id is not null and not exists(select 1 from public.categorias where id=new.categoria_id and user_id=new.user_id) then raise exception 'La categoría no pertenece al usuario'; end if;
  return new;
end $$;
create trigger presupuesto_categoria_propietario before insert or update on public.presupuestos for each row execute function public.validar_categoria_propietario();
create trigger recurrente_categoria_propietario before insert or update on public.gastos_recurrentes for each row execute function public.validar_categoria_propietario();
alter table public.gastos_recurrentes add column archivada boolean not null default false;

create or replace function public.buscar_historial_financiero(
  p_busqueda text default '', p_tipo text default 'todos', p_metodo text default 'todos',
  p_cuenta uuid default null, p_categoria uuid default null, p_naturaleza text default null,
  p_desde date default null, p_hasta date default null, p_revision boolean default false,
  p_offset integer default 0, p_limite integer default 50
) returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  with movimientos as (
    select 'transaccion'::text clase,'tx-'||t.id::text key,t.fecha,t.creado_en,
      to_jsonb(t)||jsonb_build_object('categoria',to_jsonb(c)-'user_id','cliente',case when cli.id is null then null else jsonb_build_object('id',cli.id,'nombre',cli.nombre) end,'cuenta',jsonb_build_object('id',a.id,'nombre',a.nombre),'cuenta_destino',case when b.id is null then null else jsonb_build_object('id',b.id,'nombre',b.nombre) end) data
    from public.transacciones t join public.categorias c on c.id=t.categoria_id
    left join public.clientes cli on cli.id=t.cliente_id
    left join public.cuentas_financieras a on a.id=t.cuenta_id
    left join public.cuentas_financieras b on b.id=t.cuenta_destino_id
    where t.user_id=auth.uid() and t.eliminado_en is null
      and (p_desde is null or t.fecha>=p_desde) and (p_hasta is null or t.fecha<=p_hasta)
      and (p_tipo='todos' or (p_tipo='ingreso' and t.naturaleza in('ingreso','apoyo','rendimiento')) or (p_tipo='egreso' and t.naturaleza in('egreso','retencion')))
      and (p_metodo='todos' or t.metodo_pago=p_metodo)
      and (p_cuenta is null or t.cuenta_id=p_cuenta or t.cuenta_destino_id=p_cuenta)
      and (p_categoria is null or t.categoria_id=p_categoria)
      and (p_naturaleza is null or t.naturaleza=p_naturaleza)
      and (not p_revision or t.requiere_revision)
      and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(concat_ws(' ',t.descripcion,c.nombre,c.familia,cli.nombre,a.nombre,b.nombre,array_to_string(t.etiquetas,' '))))>0)
    union all
    select 'transferencia','tr-'||t.id::text,t.fecha,t.creado_en,
      to_jsonb(t)||jsonb_build_object('cuenta_origen',jsonb_build_object('id',a.id,'nombre',a.nombre),'cuenta_destino',jsonb_build_object('id',b.id,'nombre',b.nombre))
    from public.transferencias t left join public.cuentas_financieras a on a.id=t.cuenta_origen_id left join public.cuentas_financieras b on b.id=t.cuenta_destino_id
    where t.user_id=auth.uid() and t.eliminado_en is null and p_tipo='todos' and p_categoria is null and not p_revision
      and (p_naturaleza is null or p_naturaleza='traspaso')
      and (p_desde is null or t.fecha>=p_desde) and (p_hasta is null or t.fecha<=p_hasta)
      and (p_metodo='todos' or t.origen=p_metodo or t.destino=p_metodo)
      and (p_cuenta is null or t.cuenta_origen_id=p_cuenta or t.cuenta_destino_id=p_cuenta)
      and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(concat_ws(' ',t.descripcion,a.nombre,b.nombre)))>0)
  ), pagina as (
    select * from movimientos order by fecha desc,creado_en desc,key desc
    limit greatest(1,least(coalesce(p_limite,50),1000)) offset greatest(0,coalesce(p_offset,0))
  ) select jsonb_build_object('filas',coalesce((select jsonb_agg(to_jsonb(pagina)) from pagina),'[]'::jsonb),'total',(select count(*) from movimientos));
$$;
revoke all on function public.buscar_historial_financiero(text,text,text,uuid,uuid,text,date,date,boolean,integer,integer) from public;
grant execute on function public.buscar_historial_financiero(text,text,text,uuid,uuid,text,date,date,boolean,integer,integer) to authenticated;

create or replace function public.guardar_presupuestos_financieros(p_mes date,p_limites jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare item jsonb; categoria uuid; limite numeric; lote uuid:=gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if extract(day from p_mes)<>1 then raise exception 'Mes inválido'; end if;
  if jsonb_typeof(p_limites)<>'array' or jsonb_array_length(p_limites)>300 then raise exception 'Límites inválidos'; end if;
  insert into public.meses_presupuestados(user_id,mes) values(auth.uid(),p_mes) on conflict do nothing;
  perform set_config('app.lote_financiero',lote::text,true);
  insert into public.lotes_financieros(id,user_id,nombre) values(lote,auth.uid(),'Actualizar presupuestos');
  for item in select value from jsonb_array_elements(p_limites) loop
    categoria:=(item->>'categoria_id')::uuid; limite:=(item->>'monto_limite')::numeric;
    if limite is null or limite::text in('NaN','Infinity','-Infinity') then raise exception 'Importe inválido'; end if;
    if not exists(select 1 from public.categorias where id=categoria and user_id=auth.uid() and tipo='egreso' and coalesce(naturaleza,'egreso')='egreso' and not archivada) then raise exception 'El presupuesto requiere una categoría propia de consumo'; end if;
    if limite<=0 then delete from public.presupuestos where user_id=auth.uid() and categoria_id=categoria and mes=p_mes;
    else insert into public.presupuestos(user_id,categoria_id,monto_limite,mes) values(auth.uid(),categoria,round(limite,2),p_mes)
      on conflict(user_id,categoria_id,mes) do update set monto_limite=excluded.monto_limite;
    end if;
  end loop;
end $$;
revoke all on function public.guardar_presupuestos_financieros(date,jsonb) from public;
grant execute on function public.guardar_presupuestos_financieros(date,jsonb) to authenticated;

create or replace function public.copiar_presupuestos_vigentes(p_mes date) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare anterior date;
begin
  if auth.uid() is null or extract(day from p_mes)<>1 then raise exception 'Mes inválido'; end if;
  insert into public.meses_presupuestados(user_id,mes) values(auth.uid(),p_mes) on conflict do nothing;
  if not found then return; end if;
  select max(mes) into anterior from public.presupuestos where user_id=auth.uid() and mes<p_mes;
  if anterior is null then return; end if;
  perform set_config('app.lote_financiero',gen_random_uuid()::text,true);
  insert into public.presupuestos(user_id,categoria_id,monto_limite,mes)
  select p.user_id,p.categoria_id,p.monto_limite,p_mes from public.presupuestos p join public.categorias c on c.id=p.categoria_id
  where p.user_id=auth.uid() and p.mes=anterior and not c.archivada and coalesce(c.naturaleza,'egreso')='egreso'
  on conflict(user_id,categoria_id,mes) do nothing;
end $$;
revoke all on function public.copiar_presupuestos_vigentes(date) from public;
grant execute on function public.copiar_presupuestos_vigentes(date) to authenticated;

create table public.meses_presupuestados (
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,
  primary key(user_id,mes)
);
alter table public.meses_presupuestados enable row level security;
create policy meses_presupuestados_propietario on public.meses_presupuestados for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- Compatibilidad de la RPC histórica con el mismo libro usado por la app.
create or replace function public.calcular_saldo_historico(p_fecha_limite date)
returns table(efectivo numeric,tarjeta numeric) language sql stable security invoker set search_path=public,pg_temp as $$
  with movimientos as (
    select cuenta_id cuenta,case when naturaleza in('ingreso','apoyo','rendimiento','reembolso','financiacion','ajuste_entrada','ingreso_pendiente') then monto else -monto end delta
    from public.transacciones where user_id=auth.uid() and fecha<p_fecha_limite and eliminado_en is null and naturaleza<>'traspaso'
    union all select cuenta_id,-monto from public.transacciones where user_id=auth.uid() and fecha<p_fecha_limite and eliminado_en is null and naturaleza='traspaso'
    union all select cuenta_destino_id,monto from public.transacciones where user_id=auth.uid() and fecha<p_fecha_limite and eliminado_en is null and naturaleza='traspaso'
    union all select cuenta_origen_id,-monto from public.transferencias where user_id=auth.uid() and fecha<p_fecha_limite and eliminado_en is null
    union all select cuenta_destino_id,monto from public.transferencias where user_id=auth.uid() and fecha<p_fecha_limite and eliminado_en is null
  ) select coalesce(sum(m.delta) filter(where c.metodo_pago='efectivo'),0)::numeric,
    coalesce(sum(m.delta) filter(where c.metodo_pago='tarjeta'),0)::numeric
  from movimientos m join public.cuentas_financieras c on c.id=m.cuenta and c.user_id=auth.uid() and not c.excluida_disponible;
$$;
grant select,insert,update,delete on public.cuentas_financieras,public.lotes_financieros,public.solicitudes_asesor,public.meses_presupuestados to authenticated;
grant select on public.cambios_financieros to authenticated;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant all on public.cuentas_financieras,public.lotes_financieros,public.solicitudes_asesor,public.meses_presupuestados,public.cambios_financieros to service_role;
    grant usage,select on sequence public.cambios_financieros_secuencia_seq to service_role;
  end if;
end $$;
create or replace function public.version_esquema_financiero() returns text language sql immutable as $$select '20261105010000_cuentas_y_clasificacion'::text$$;
notify pgrst,'reload schema';
