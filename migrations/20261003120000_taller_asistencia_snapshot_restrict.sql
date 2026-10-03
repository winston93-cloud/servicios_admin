-- Cada pase de lista guarda el maestro y el horario vigentes ese día: editar el grupo después
-- (cambio de maestro, día o duración) ya no reescribe las horas pasadas del reporte.
-- Borrar un grupo con asistencia queda prohibido en BD (la app hace baja lógica con activo = false).

alter table public.taller_asistencia
  add column if not exists maestro_id integer references public.taller_maestro(id) on delete restrict,
  add column if not exists hora_inicio time,
  add column if not exists hora_fin time,
  add column if not exists minutos_programados integer
    check (minutos_programados is null or minutos_programados between 0 and 1440);

alter table public.taller_asistencia drop constraint if exists taller_asistencia_asignacion_id_fkey;
alter table public.taller_asistencia
  add constraint taller_asistencia_asignacion_id_fkey
  foreign key (asignacion_id) references public.taller_asignacion(id) on delete restrict;
