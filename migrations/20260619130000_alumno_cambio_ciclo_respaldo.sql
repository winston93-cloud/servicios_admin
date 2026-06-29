-- Respaldo para revertir migraciones del módulo «Cambio de ciclo escolar».
-- Ejecutar en InsForge antes de usar el módulo en producción.

CREATE TABLE IF NOT EXISTS public.alumno_cambio_ciclo_respaldo (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL,
  alumno_ciclo_escolar INTEGER NOT NULL,
  alumno_nivel INTEGER NOT NULL,
  alumno_grado INTEGER NOT NULL,
  alumno_grupo INTEGER NOT NULL DEFAULT 1,
  alumno_nuevo_ingreso SMALLINT NOT NULL DEFAULT 0,
  alumno_status SMALLINT NOT NULL DEFAULT 1,
  ciclo_destino INTEGER NOT NULL,
  nivel_destino INTEGER NOT NULL,
  grado_destino INTEGER NOT NULL,
  migrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alumno_cambio_ciclo_respaldo_alumno_id_unique UNIQUE (alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_alumno_cambio_ciclo_respaldo_alumno_id
  ON public.alumno_cambio_ciclo_respaldo (alumno_id);

ALTER TABLE public.alumno_cambio_ciclo_respaldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_cambio_ciclo_respaldo FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_cambio_ciclo_respaldo;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_cambio_ciclo_respaldo
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON public.alumno_cambio_ciclo_respaldo FROM anon, authenticated;
