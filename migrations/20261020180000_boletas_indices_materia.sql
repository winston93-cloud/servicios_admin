-- Búsquedas por ciclo + materia (captura del maestro, promedios por materia) leían la tabla completa.
-- CONCURRENTLY: se construye sin bloquear escrituras; correr cada sentencia por separado (fuera de transacción).
CREATE INDEX CONCURRENTLY IF NOT EXISTS boleta_calif_ciclo_materia_idx
  ON public.boleta_calificacion (calificacion_ciclo_escolar, materia_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS boleta_inasistencia_ciclo_materia_idx
  ON public.boleta_inasistencia (inasistencia_ciclo_escolar, materia_id);
