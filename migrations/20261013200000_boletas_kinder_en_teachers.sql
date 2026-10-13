-- Boletas Kinder Inglés: catálogos editables por la directora, entrega de la teacher a dirección
-- y publicación a papás por grado y grupo.

-- Indicadores (subjects / behavioral skills / maternal) por grado. Los ids son los mismos que ya
-- usan las tablas de calificaciones (indicador_id), así que la captura existente sigue válida.
CREATE TABLE IF NOT EXISTS public.boleta_kinder_en_indicador (
  tipo text NOT NULL CHECK (tipo IN ('subject', 'behavioral', 'maternal')),
  grado smallint NOT NULL CHECK (grado BETWEEN 0 AND 3),
  indicador_id integer NOT NULL CHECK (indicador_id > 0),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  orden smallint NOT NULL DEFAULT 0,
  formato text NOT NULL DEFAULT 'escala' CHECK (formato IN ('escala', 'numero')),
  en_promedio boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, grado, indicador_id),
  CHECK ((tipo = 'maternal') = (grado = 0))
);

INSERT INTO public.boleta_kinder_en_indicador (tipo, grado, indicador_id, nombre, orden, formato, en_promedio)
VALUES
  ('subject', 1, 1, 'VOCABULARY', 1, 'escala', true),
  ('subject', 1, 2, 'PHONICS', 2, 'escala', true),
  ('subject', 1, 3, 'PRE MATH', 3, 'escala', true),
  ('subject', 1, 4, 'PRE-WRITING', 4, 'escala', true),
  ('subject', 1, 5, 'SHOW AND TELL PROJECT', 5, 'escala', true),
  ('subject', 1, 6, 'MUSIC', 6, 'escala', false),
  ('subject', 1, 7, 'MINDFULNESS', 7, 'escala', false),
  ('subject', 2, 8, 'VOCABULARY', 1, 'escala', true),
  ('subject', 2, 9, 'PHONICS', 2, 'escala', true),
  ('subject', 2, 10, 'PRE MATH', 3, 'escala', true),
  ('subject', 2, 11, 'PRE-WRITING', 4, 'escala', true),
  ('subject', 2, 12, 'SHOW AND TELL PROJECT', 5, 'escala', true),
  ('subject', 2, 13, 'MUSIC', 6, 'escala', false),
  ('subject', 2, 14, 'MINDFULNESS', 7, 'escala', false),
  ('subject', 3, 15, 'VOCABULARY', 1, 'escala', true),
  ('subject', 3, 16, 'PHONICS', 2, 'escala', true),
  ('subject', 3, 17, 'MATH', 3, 'escala', true),
  ('subject', 3, 18, 'WRITING', 4, 'escala', true),
  ('subject', 3, 19, 'SHOW AND TELL PROJECT', 5, 'escala', true),
  ('subject', 3, 20, 'MUSIC', 6, 'escala', false),
  ('subject', 3, 21, 'MINDFULNESS', 7, 'escala', false),
  ('behavioral', 1, 101, 'MAKES REAL WORLD CONNECTIONS', 1, 'escala', false),
  ('behavioral', 1, 102, 'DEVELOPS COORDINATION AND BALANCE', 2, 'escala', false),
  ('behavioral', 1, 103, 'COMMUNICATES CLEARLY', 3, 'escala', false),
  ('behavioral', 1, 104, 'UNDERSTANDING OF RULES DIRECTIONS AND ROUTINES', 4, 'escala', false),
  ('behavioral', 1, 105, 'SHOWS RESPECT TO TEACHERS AND CLASSMATES', 5, 'escala', false),
  ('behavioral', 1, 106, 'INVESTS TIME IN ACTIVITIES DESPITE DISTRACTIONS', 6, 'escala', false),
  ('behavioral', 1, 107, 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING', 7, 'escala', false),
  ('behavioral', 1, 108, 'WORK IS NEAT AND ORGANIZED', 8, 'escala', false),
  ('behavioral', 1, 109, 'USES MATERIALS SAFELY AND APPROPRIATELY', 9, 'escala', false),
  ('behavioral', 1, 110, 'TAKES TURNS DURING ACTIVITIES', 10, 'escala', false),
  ('behavioral', 1, 111, 'COMPLETES DAILY WORK', 11, 'escala', false),
  ('behavioral', 1, 112, 'DOES HOMEWORK', 12, 'escala', false),
  ('behavioral', 1, 113, 'PUNCTUALITY', 13, 'escala', false),
  ('behavioral', 2, 101, 'MAKES REAL WORLD CONNECTIONS', 1, 'escala', false),
  ('behavioral', 2, 102, 'DEVELOPS COORDINATION AND BALANCE', 2, 'escala', false),
  ('behavioral', 2, 103, 'COMMUNICATES CLEARLY', 3, 'escala', false),
  ('behavioral', 2, 104, 'UNDERSTANDING OF RULES DIRECTIONS AND ROUTINES', 4, 'escala', false),
  ('behavioral', 2, 105, 'SHOWS RESPECT TO TEACHERS AND CLASSMATES', 5, 'escala', false),
  ('behavioral', 2, 106, 'INVESTS TIME IN ACTIVITIES DESPITE DISTRACTIONS', 6, 'escala', false),
  ('behavioral', 2, 107, 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING', 7, 'escala', false),
  ('behavioral', 2, 108, 'WORK IS NEAT AND ORGANIZED', 8, 'escala', false),
  ('behavioral', 2, 109, 'USES MATERIALS SAFELY AND APPROPRIATELY', 9, 'escala', false),
  ('behavioral', 2, 110, 'TAKES TURNS DURING ACTIVITIES', 10, 'escala', false),
  ('behavioral', 2, 111, 'COMPLETES DAILY WORK', 11, 'escala', false),
  ('behavioral', 2, 112, 'DOES HOMEWORK', 12, 'escala', false),
  ('behavioral', 2, 113, 'PUNCTUALITY', 13, 'escala', false),
  ('behavioral', 3, 101, 'SELF CONTROL', 1, 'escala', false),
  ('behavioral', 3, 102, 'UNDERSTANDING OF RULES DIRECTIONS AND ROUTINES', 2, 'escala', false),
  ('behavioral', 3, 103, 'SHOWS RESPECT TO TEACHERS AND CLASSMATES', 3, 'escala', false),
  ('behavioral', 3, 104, 'INVESTS TIME IN ACTIVITIES DESPITE DISTRACTIONS', 4, 'escala', false),
  ('behavioral', 3, 105, 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING', 5, 'escala', false),
  ('behavioral', 3, 106, 'WORK IS NEAT AND ORGANIZED', 6, 'escala', false),
  ('behavioral', 3, 107, 'USES MATERIALS SAFELY AND APPROPRIATELY', 7, 'escala', false),
  ('behavioral', 3, 108, 'TAKES TURNS DURING ACTIVITIES', 8, 'escala', false),
  ('behavioral', 3, 109, 'COMPLETES DAILY WORK', 9, 'escala', false),
  ('behavioral', 3, 110, 'DOES HOMEWORK', 10, 'escala', false),
  ('behavioral', 3, 111, 'PUNCTUALITY', 11, 'escala', false),
  ('maternal', 0, 1, 'IDENTIFIES AND NAMES NUMBERS FROM 1 TO 10', 1, 'escala', false),
  ('maternal', 0, 2, 'IDENTIFIES AND NAMES COLORS', 2, 'escala', false),
  ('maternal', 0, 3, 'IDENTIFIES AND NAMES BASIC SHAPES', 3, 'escala', false),
  ('maternal', 0, 4, 'KNOWS THE DAYS OF THE WEEK', 4, 'escala', false),
  ('maternal', 0, 5, 'IDENTIFIES VOWELS AND THEIR VOCABULARY', 5, 'escala', false),
  ('maternal', 0, 6, 'UNDERSTANDING OF RULES AND ROUTINES', 6, 'escala', false),
  ('maternal', 0, 7, 'DOES CLASSWORK INDEPENDENTLY', 7, 'escala', false),
  ('maternal', 0, 8, 'DEVELOPS COORDINATION AND BALANCE', 8, 'escala', false),
  ('maternal', 0, 9, 'USES MATERIALS SAFELY AND APPROPRIATELY', 9, 'escala', false),
  ('maternal', 0, 10, 'SHOWS AN INTEREST IN LEARNING BY PARTICIPATING', 10, 'escala', false),
  ('maternal', 0, 11, 'TAKES TURNS DURING ACTIVITIES', 11, 'escala', false),
  ('maternal', 0, 12, 'COMMUNICATES CLEARLY', 12, 'escala', false),
  ('maternal', 0, 13, 'SHOWS RESPECT TO TEACHERS AND CLASSMATES', 13, 'escala', false),
  ('maternal', 0, 14, 'DOES HOMEWORK', 14, 'escala', false),
  ('maternal', 0, 15, 'PUNCTUALITY', 15, 'escala', false),
  ('maternal', 0, 16, 'SCHOOL DAYS', 16, 'numero', false),
  ('maternal', 0, 17, 'DAYS ABSENT', 17, 'numero', false)
ON CONFLICT (tipo, grado, indicador_id) DO NOTHING;

ALTER TABLE public.boleta_kinder_en_indicador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_kinder_en_indicador FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_kinder_en_indicador;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_kinder_en_indicador
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_kinder_en_indicador FROM anon, authenticated;

-- Entrega de la captura a dirección por grupo y trimestre. Sin fila = la teacher sigue capturando.
-- 'enviada' bloquea su captura; 'devuelta' se la reabre con el comentario de la directora.
CREATE TABLE IF NOT EXISTS public.boleta_entrega (
  ciclo smallint NOT NULL,
  modulo text NOT NULL CHECK (modulo IN ('kinder-es', 'kinder-en', 'primaria-es', 'primaria-en', 'secundaria')),
  trimestre smallint NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  grado smallint NOT NULL,
  grupo text NOT NULL CHECK (char_length(grupo) BETWEEN 1 AND 4),
  estado text NOT NULL CHECK (estado IN ('enviada', 'devuelta')),
  maestro_id integer,
  enviada_por text,
  enviada_at timestamptz,
  devuelta_por text,
  devuelta_at timestamptz,
  comentario text CHECK (char_length(comentario) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ciclo, modulo, trimestre, grado, grupo)
);

ALTER TABLE public.boleta_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_entrega FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_entrega;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_entrega
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_entrega FROM anon, authenticated;

-- Publicación a papás por grado y grupo. grado 0 + grupo '' = todo el módulo (como hasta ahora).
ALTER TABLE public.boleta_publicacion ADD COLUMN IF NOT EXISTS grado smallint NOT NULL DEFAULT 0;
ALTER TABLE public.boleta_publicacion ADD COLUMN IF NOT EXISTS grupo text NOT NULL DEFAULT '';
ALTER TABLE public.boleta_publicacion DROP CONSTRAINT IF EXISTS boleta_publicacion_pkey;
ALTER TABLE public.boleta_publicacion ADD PRIMARY KEY (ciclo, modulo, trimestre, grado, grupo);

-- Idioma del docente de maternal/kinder/primaria: 'en' = teacher de inglés, 'es' = maestra de español.
ALTER TABLE public.boleta_maestro ADD COLUMN IF NOT EXISTS maestro_idioma text
  CHECK (maestro_idioma IN ('es', 'en'));

UPDATE public.boleta_maestro m SET maestro_idioma = 'en'
WHERE m.maestro_idioma IS NULL AND m.maestro_nivel IN (1, 2) AND EXISTS (
  SELECT 1 FROM public.boleta_maestro_grupo g
  JOIN public.boleta_materia mt ON mt.materia_id = g.materia_id
  WHERE g.maestro_id = m.maestro_id AND mt.materia_nombre = 'Teacher'
);

UPDATE public.boleta_maestro m SET maestro_idioma = 'es'
WHERE m.maestro_idioma IS NULL AND m.maestro_nivel IN (1, 2) AND EXISTS (
  SELECT 1 FROM public.boleta_maestro_grupo g
  JOIN public.boleta_materia mt ON mt.materia_id = g.materia_id
  WHERE g.maestro_id = m.maestro_id AND mt.materia_nombre = 'Maestro(a)'
);
