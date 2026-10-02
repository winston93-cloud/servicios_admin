-- Incidencia del maestro en la clase: llegó tarde y/o salió antes de la hora del horario.
-- Informativo: el reporte de horas sigue calculando con el horario del grupo.

alter table public.taller_asistencia
  add column if not exists llegada_maestro time,
  add column if not exists salida_maestro time,
  add column if not exists incidencia_motivo text,
  add column if not exists incidencia_nota text,
  add column if not exists incidencia_por text,
  add column if not exists incidencia_at timestamptz;
