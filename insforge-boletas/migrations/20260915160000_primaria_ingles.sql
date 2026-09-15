-- Primaria Inglés — calificaciones, skills, attendance
-- Paridad legacy ingles (ing_cal / ing_csk / ing_att tip 1=días, 2=faltas).
-- Catálogos: app `boletasPrimariaEnCatalog.ts` (no se seedan en DB).
-- Aplicar en el proyecto InsForge «boletas» (NO en Winston Servicios):
--   cd insforge-boletas && npx -y @insforge/cli db query "$(cat migrations/20260915160000_primaria_ingles.sql)"

CREATE TABLE IF NOT EXISTS public.boleta_calificacion_primaria_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, materia_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_calif_pen_alumno_idx
  ON public.boleta_calificacion_primaria_en (alumno_id, ciclo, bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_skill_primaria_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, skill_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_skill_pen_alumno_idx
  ON public.boleta_skill_primaria_en (alumno_id, ciclo, bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_attendance_primaria_en (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  school_days VARCHAR(20) NOT NULL DEFAULT '',
  days_absent VARCHAR(20) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_att_pen_alumno_idx
  ON public.boleta_attendance_primaria_en (alumno_id, ciclo, bimestre);

-- RLS deny-anon (API solo con service key), mismo estilo que primaria_espanol / kinder_ingles
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boleta_calificacion_primaria_en',
    'boleta_skill_primaria_en',
    'boleta_attendance_primaria_en'
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
