-- Conducta: quien captura (maestra o psicología) pidió saltar el aviso y registrar como Reporte I.
-- Se guarda para respetarlo cuando Psicología aprueba un reporte pendiente (ahí se recalcula el escalón).
alter table public.reporte_escolar
  add column if not exists reporte_saltar_aviso smallint not null default 0;
