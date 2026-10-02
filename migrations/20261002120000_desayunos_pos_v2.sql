-- Desayunos POS v2: reparto Ludy/caja en catálogo, entregas reales y venta agrupada.

alter table concepto_desayunos add column if not exists monto_ludi numeric(10,2) not null default 0;
alter table concepto_desayunos add column if not exists codigo_reporte varchar(20);
alter table concepto_desayunos add column if not exists orden smallint not null default 0;
alter table concepto_desayunos add column if not exists activo boolean not null default true;

update concepto_desayunos set codigo_reporte = 'DCH', monto_ludi = 45, orden = 1 where desayuno_abreviatura = 'dc';
update concepto_desayunos set codigo_reporte = 'DG', monto_ludi = 55, orden = 2 where desayuno_abreviatura = 'dg';
update concepto_desayunos set codigo_reporte = 'COMIDA', monto_ludi = 80, orden = 3 where desayuno_abreviatura = 'cc';
update concepto_desayunos set codigo_reporte = 'MEDIA', monto_ludi = 0, orden = 4 where desayuno_abreviatura = 'm';
update concepto_desayunos set codigo_reporte = 'ESTANCIA 5', monto_ludi = 80, orden = 5 where desayuno_abreviatura = 'e5';
update concepto_desayunos set codigo_reporte = 'ESTANCIA 7', monto_ludi = 80, orden = 6 where desayuno_abreviatura = 'e7';
update concepto_desayunos set codigo_reporte = 'TAREA 5', monto_ludi = 0, orden = 7 where desayuno_abreviatura = 't5';
update concepto_desayunos set codigo_reporte = 'TAREA 7', monto_ludi = 0, orden = 8 where desayuno_abreviatura = 't7';
update concepto_desayunos set codigo_reporte = 'EST. MES 5', monto_ludi = 80, orden = 9 where desayuno_abreviatura = 'em5';
update concepto_desayunos set codigo_reporte = 'EST. MES 7', monto_ludi = 80, orden = 10 where desayuno_abreviatura = 'em7';

alter table pago_desayunos add column if not exists pago_concepto_id integer;
alter table pago_desayunos add column if not exists pago_ludi numeric(10,2);
alter table pago_desayunos add column if not exists pago_cliente varchar(200);
alter table pago_desayunos add column if not exists pago_recibido numeric(10,2);
alter table pago_desayunos add column if not exists pago_entregado boolean not null default false;
alter table pago_desayunos add column if not exists pago_entregado_at timestamptz;
alter table pago_desayunos add column if not exists pago_alta timestamptz not null default now();

create index if not exists pago_desayunos_fecha_idx on pago_desayunos (pago_fecha);
create index if not exists pago_desayunos_ref_idx on pago_desayunos (pago_ref);
create index if not exists pago_desayunos_orden_idx on pago_desayunos (pago_orden);
