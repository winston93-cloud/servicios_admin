-- Primaria Español — calificaciones normalizadas (paridad legacy prim_lenguajes/saberes/humano/etica/extra/habilidades)
-- Catálogo de materias por bloque/grado: app `boletasPrimariaEsCatalog.ts` (no se seedan en DB).
-- bloque + materia_id = id_materia legacy dentro de cada tabla prim_*.
-- Aplicar en el proyecto InsForge «boletas» (NO en Winston Servicios):
--   cd insforge-boletas && npx -y @insforge/cli db query "$(cat migrations/20260915150000_primaria_espanol.sql)"

CREATE TABLE IF NOT EXISTS public.boleta_calificacion_primaria_es (
  id BIGSERIAL PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  bloque TEXT NOT NULL CHECK (
    bloque IN ('lenguajes', 'saberes', 'humano', 'etica', 'extra', 'habilidades')
  ),
  materia_id INTEGER NOT NULL,
  bimestre SMALLINT NOT NULL CHECK (bimestre BETWEEN 1 AND 3),
  ciclo SMALLINT NOT NULL,
  calificacion VARCHAR(40) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alumno_id, bloque, materia_id, bimestre, ciclo)
);

CREATE INDEX IF NOT EXISTS boleta_calif_pe_alumno_idx
  ON public.boleta_calificacion_primaria_es (alumno_id, ciclo, bimestre);

CREATE INDEX IF NOT EXISTS boleta_calif_pe_bloque_idx
  ON public.boleta_calificacion_primaria_es (bloque, materia_id);

-- RLS deny-anon (API solo con service key), mismo estilo que kinder_espanol
DO $$
DECLARE
  t text := 'boleta_calificacion_primaria_es';
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
