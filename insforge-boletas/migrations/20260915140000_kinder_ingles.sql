-- Kinder Inglés / English Preschool — calificaciones, behavioral, attendance, maternal
-- Paridad legacy boletasik (boleta_calificacionpk / pck / pckt / pcm).
-- Catálogos de indicadores: app `boletasKinderEnCatalog.ts` (no se seedan en DB).
-- Aplicar en el proyecto InsForge «boletas» (NO en Winston Servicios).

CREATE TABLE IF NOT EXISTS public.boleta_calificacion_kinder_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  indicador_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, indicador_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_calif_ken_alumno_idx
  ON public.boleta_calificacion_kinder_en (alumno_id, ciclo, bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_behavioral_kinder_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  indicador_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, indicador_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_beh_ken_alumno_idx
  ON public.boleta_behavioral_kinder_en (alumno_id, ciclo, bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_attendance_kinder_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  school_days VARCHAR(20) NOT NULL DEFAULT '',
  days_absent VARCHAR(20) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_att_ken_alumno_idx
  ON public.boleta_attendance_kinder_en (alumno_id, ciclo, bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_calificacion_maternal_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  indicador_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, indicador_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_calif_men_alumno_idx
  ON public.boleta_calificacion_maternal_en (alumno_id, ciclo, bimestre);

-- RLS deny-anon (API solo con service key), mismo estilo que kinder_espanol
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boleta_calificacion_kinder_en',
    'boleta_behavioral_kinder_en',
    'boleta_attendance_kinder_en',
    'boleta_calificacion_maternal_en'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS boletas_deny_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY boletas_deny_anon ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
