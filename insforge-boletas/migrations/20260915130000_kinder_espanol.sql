-- Kinder Español — calificaciones por indicador (paridad legacy boletasek / boleta_calificacionpke)
-- Indicadores (ids 1–58, grados K1–K3): catálogo en app `boletasKinderEsCatalog.ts` (no se seedan en DB).
-- Aplicar en el proyecto InsForge «boletas» (NO en Winston Servicios).

CREATE TABLE IF NOT EXISTS public.boleta_calificacion_kinder_es (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  indicador_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, indicador_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_calif_ke_alumno_idx
  ON public.boleta_calificacion_kinder_es (alumno_id, ciclo, bimestre);

-- RLS deny-anon (API solo con service key), mismo estilo que 20260813120000_boletas_schema.sql
DO $$
DECLARE
  t text := 'boleta_calificacion_kinder_es';
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS boletas_deny_anon ON public.%I', t);
  EXECUTE format(
    'CREATE POLICY boletas_deny_anon ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
    t
  );
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
END $$;
