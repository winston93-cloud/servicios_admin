-- Boleta Primaria Español ← Google Classroom: igual que Primaria Inglés (último cambio gana), pero la clase es
-- «{grado}{grupo} {materia}» de la maestra titular del grupo y el trimestre sale de las fechas que captura la
-- dirección (boleta_trimestre_fechas, módulo primaria-es). Las ligas de alumnos se comparten en
-- boleta_classroom_alumno.

CREATE TABLE IF NOT EXISTS public.boleta_classroom_calif_primaria_es (
  alumno_id integer NOT NULL,
  materia_id integer NOT NULL,
  bimestre integer NOT NULL,
  ciclo integer NOT NULL,
  valor_classroom varchar(10) NOT NULL,
  origen text NOT NULL DEFAULT 'classroom' CHECK (origen IN ('classroom', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, materia_id, bimestre, ciclo)
);

CREATE TABLE IF NOT EXISTS public.boleta_classroom_sync_primaria_es (
  ciclo integer NOT NULL,
  bimestre integer NOT NULL,
  grado integer NOT NULL,
  grupo text NOT NULL,
  sincronizado_en timestamptz NOT NULL DEFAULT now(),
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (ciclo, bimestre, grado, grupo)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['boleta_classroom_calif_primaria_es', 'boleta_classroom_sync_primaria_es'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.%I', t);
    EXECUTE format('CREATE POLICY servicios_insforge_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
