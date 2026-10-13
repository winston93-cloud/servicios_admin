-- Team English: la teacher construye la planeación semanal en el portal (lienzo por día y skill)
-- en lugar de solo subir un archivo. «borrador» = en construcción, aún no enviada a revisión.

alter table public.te_planeacion add column if not exists contenido jsonb;

alter table public.te_planeacion drop constraint if exists te_planeacion_estado_check;
alter table public.te_planeacion
  add constraint te_planeacion_estado_check check (estado in ('borrador', 'pendiente', 'aprobada', 'cambios'));

alter table public.te_planeacion drop constraint if exists te_planeacion_contenido_check;
alter table public.te_planeacion
  add constraint te_planeacion_contenido_check check (contenido is null or octet_length(contenido::text) <= 80000);
