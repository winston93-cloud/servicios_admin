-- Boleta Secundaria ← Google Classroom. Las clases de secundaria son de todo el ciclo («7A ARTES»), así que
-- la dirección captura inicio y fin de cada trimestre y solo cuentan las tareas con fecha en ese rango.
-- Calificación de Classroom (0–100) ÷ 10, truncada a un decimal, mínimo 5. Gana el último cambio, como en
-- Primaria Inglés. Los alumnos ligados se comparten en boleta_classroom_alumno.

-- Inicio y fin de cada trimestre por ciclo y módulo de boletas.
CREATE TABLE IF NOT EXISTS public.boleta_trimestre_fechas (
  ciclo integer NOT NULL,
  modulo text NOT NULL,
  trimestre integer NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  inicio date NOT NULL,
  fin date NOT NULL CHECK (fin >= inicio),
  actualizado_por text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ciclo, modulo, trimestre)
);

-- Último valor que dio Classroom por calificación y de dónde salió el valor vigente de la boleta.
CREATE TABLE IF NOT EXISTS public.boleta_classroom_calif_sec (
  alumno_id integer NOT NULL,
  materia_id integer NOT NULL,
  bimestre integer NOT NULL,
  ciclo integer NOT NULL,
  valor_classroom varchar(10) NOT NULL,
  origen text NOT NULL DEFAULT 'classroom' CHECK (origen IN ('classroom', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, materia_id, bimestre, ciclo)
);

-- Última sincronización por materia, grupo y trimestre (máximo una vez cada 2 minutos).
CREATE TABLE IF NOT EXISTS public.boleta_classroom_sync_sec (
  ciclo integer NOT NULL,
  bimestre integer NOT NULL,
  materia_id integer NOT NULL,
  grupo text NOT NULL,
  sincronizado_en timestamptz NOT NULL DEFAULT now(),
  resumen jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (ciclo, bimestre, materia_id, grupo)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['boleta_trimestre_fechas', 'boleta_classroom_calif_sec', 'boleta_classroom_sync_sec'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.%I', t);
    EXECUTE format('CREATE POLICY servicios_insforge_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
