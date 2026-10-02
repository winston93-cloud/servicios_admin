-- Incidencia sin pase de lista (lista_pasada = false) y maestro que no asistió.

alter table public.taller_asistencia
  add column if not exists lista_pasada boolean not null default true,
  add column if not exists maestro_falto boolean not null default false;
