-- Boleta Primaria Inglés ← Google Classroom: la calificación del trimestre se calcula desde las clases de la
-- teacher (categorías con porcentaje, como Classroom) y se escribe en boleta_calificacion_primaria_en.
-- Gana el último cambio: si Classroom cambia, reemplaza; si la teacher ajusta en el sistema, se queda hasta
-- que Classroom vuelva a cambiar.

-- Alumno de Classroom (id de usuario de Google) ↔ alumno del sistema. Automático por nombre o ligado a mano.
CREATE TABLE IF NOT EXISTS public.boleta_classroom_alumno (
  google_id text PRIMARY KEY,
  alumno_id integer NOT NULL,
  manual boolean NOT NULL DEFAULT false,
  ligado_por text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS boleta_classroom_alumno_alumno ON public.boleta_classroom_alumno (alumno_id);

-- Último valor que dio Classroom por calificación y de dónde salió el valor vigente de la boleta.
CREATE TABLE IF NOT EXISTS public.boleta_classroom_calif_primaria_en (
  alumno_id integer NOT NULL,
  materia_id integer NOT NULL,
  bimestre integer NOT NULL,
  ciclo integer NOT NULL,
  valor_classroom varchar(10) NOT NULL,
  origen text NOT NULL DEFAULT 'classroom' CHECK (origen IN ('classroom', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, materia_id, bimestre, ciclo)
);

-- Última sincronización por grupo y trimestre (evita pedirle a Google más de una vez cada 2 minutos).
CREATE TABLE IF NOT EXISTS public.boleta_classroom_sync (
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
  FOREACH t IN ARRAY ARRAY['boleta_classroom_alumno', 'boleta_classroom_calif_primaria_en', 'boleta_classroom_sync'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.%I', t);
    EXECUTE format('CREATE POLICY servicios_insforge_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
