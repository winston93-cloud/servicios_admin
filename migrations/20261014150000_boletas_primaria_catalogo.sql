-- Boletas Primaria (español e inglés): materias editables por la directora, una sola tabla de
-- calificaciones por idioma (materia_id único por idioma) y teachers/maestras con idioma.
-- Las tablas de calificaciones de primaria estaban vacías al crear esta migración.

CREATE TABLE IF NOT EXISTS public.boleta_primaria_materia (
  idioma text NOT NULL CHECK (idioma IN ('es', 'en')),
  grado smallint NOT NULL CHECK (grado BETWEEN 1 AND 6),
  materia_id integer NOT NULL CHECK (materia_id > 0),
  -- es: lenguajes · saberes · humano · etica · extra · habilidades
  -- en: subject · extra · skill
  seccion text NOT NULL CHECK (
    (idioma = 'es' AND seccion IN ('lenguajes', 'saberes', 'humano', 'etica', 'extra', 'habilidades'))
    OR (idioma = 'en' AND seccion IN ('subject', 'extra', 'skill'))
  ),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  -- Inglés: traducción que sale a la derecha en la boleta (Gramática, Redacción…).
  nombre_alt text CHECK (char_length(nombre_alt) <= 120),
  orden smallint NOT NULL DEFAULT 0,
  en_promedio boolean NOT NULL DEFAULT true,
  -- Mindfulness: en el PDF se pinta un recuadro de color (verde ≥ 8, amarillo ≥ 6, rojo) en vez del número.
  semaforo boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idioma, materia_id)
);

-- Español: materias por grado como en el legacy boletas_español (boleta.php / prim_*).
-- id = grado * 100 + consecutivo.
INSERT INTO public.boleta_primaria_materia (idioma, grado, materia_id, seccion, nombre, orden)
SELECT 'es', g.grado, g.grado * 100 + m.n, m.seccion, m.nombre, m.n
FROM generate_series(1, 6) AS g(grado)
CROSS JOIN LATERAL (
  VALUES
    (1, 'lenguajes', 'ESPAÑOL', true),
    (2, 'lenguajes', 'INGLÉS', true),
    (3, 'lenguajes', 'ARTES', true),
    (4, 'saberes', 'MATEMÁTICAS', true),
    (5, 'saberes', 'CIENCIAS NATURALES', g.grado >= 3),
    (6, 'humano', 'EDUCACIÓN FÍSICA', true),
    (7, 'etica', 'CONOCIMIENTO DEL MEDIO', g.grado <= 2),
    (8, 'etica', 'LA ENTIDAD DONDE VIVO', g.grado = 3),
    (9, 'etica', 'GEOGRAFÍA', g.grado >= 4),
    (10, 'etica', 'HISTORIA', g.grado >= 4),
    (11, 'etica', 'FORMACIÓN CÍVICA Y ÉTICA', g.grado >= 3),
    (12, 'extra', 'COMPUTACIÓN', true),
    (13, 'extra', 'ROBÓTICA', true),
    (14, 'extra', 'EDU. FINANCIERA', true),
    (15, 'habilidades', 'AUTOCONTROL', true),
    (16, 'habilidades', 'ESCUCHA ATENTAMENTE', true),
    (17, 'habilidades', 'SIGUE INSTRUCCIONES', true),
    (18, 'habilidades', 'TRABAJA CON BUENA PRESENTACIÓN Y LIMPIEZA', true),
    (19, 'habilidades', 'MUESTRA ACTITUD POSITIVA', true),
    (20, 'habilidades', 'APRENDIZAJE COLABORATIVO', true)
) AS m(n, seccion, nombre, aplica)
WHERE m.aplica
ON CONFLICT (idioma, materia_id) DO NOTHING;

-- Inglés: plantilla actual del legacy sistemas/ingles (bol1.png): mismas materias en los 6 grados.
INSERT INTO public.boleta_primaria_materia
  (idioma, grado, materia_id, seccion, nombre, nombre_alt, orden, en_promedio, semaforo)
SELECT 'en', g.grado, g.grado * 100 + m.n, m.seccion, m.nombre, m.alt, m.n, m.prom, m.sem
FROM generate_series(1, 6) AS g(grado)
CROSS JOIN (
  VALUES
    (1, 'subject', 'Grammar', 'Gramática', true, false),
    (2, 'subject', 'Writing', 'Redacción', true, false),
    (3, 'subject', 'Reading', 'Fluidez y Comprensión lectora', true, false),
    (4, 'subject', 'Spelling & Phonics', 'Ortografía y Fonética', true, false),
    (5, 'subject', 'Vocabulary', 'Vocabulario', true, false),
    (6, 'subject', 'Mathematics', 'Matemáticas', true, false),
    (7, 'subject', 'Speaking', 'Conversación en inglés', true, false),
    (8, 'subject', 'Listening', 'Comprensión auditiva', true, false),
    (9, 'extra', 'Mindfulness', 'Edu. Socioemocional', false, true),
    (10, 'extra', 'Faith education', 'Educación en la fe', false, false),
    (11, 'skill', 'Self control', 'Control propio', false, false),
    (12, 'skill', 'Listens carefully', 'Escucha atentamente', false, false),
    (13, 'skill', 'Follows directions', 'Sigue instrucciones', false, false),
    (14, 'skill', 'Works neatly', 'Trabaja con buena presentación y limpieza', false, false),
    (15, 'skill', 'Shows a positive attitude', 'Muestra actitud positiva', false, false),
    (16, 'skill', 'Collaborative learning', 'Aprendizaje colaborativo', false, false),
    (17, 'skill', 'Communication skills', 'Habilidades de comunicación', false, false)
) AS m(n, seccion, nombre, alt, prom, sem)
ON CONFLICT (idioma, materia_id) DO NOTHING;

ALTER TABLE public.boleta_primaria_materia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_primaria_materia FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_primaria_materia;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_primaria_materia
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_primaria_materia FROM anon, authenticated;

-- Español: la calificación ya se identifica solo por materia_id (el bloque vive en el catálogo).
ALTER TABLE public.boleta_calificacion_primaria_es
  DROP CONSTRAINT IF EXISTS boleta_calificacion_primaria__alumno_id_bloque_materia_id_b_key;
ALTER TABLE public.boleta_calificacion_primaria_es
  DROP CONSTRAINT IF EXISTS boleta_calificacion_primaria_es_bloque_check;
ALTER TABLE public.boleta_calificacion_primaria_es DROP COLUMN IF EXISTS bloque;
ALTER TABLE public.boleta_calificacion_primaria_es
  DROP CONSTRAINT IF EXISTS boleta_calificacion_primaria_es_unica;
ALTER TABLE public.boleta_calificacion_primaria_es
  ADD CONSTRAINT boleta_calificacion_primaria_es_unica UNIQUE (alumno_id, materia_id, bimestre, ciclo);

-- Inglés: subjects, extras y skills van en boleta_calificacion_primaria_en (materia_id del catálogo).
DROP TABLE IF EXISTS public.boleta_skill_primaria_en;

-- Idioma de los docentes de primaria (slot Teacher = inglés, Maestro(a) = español).
UPDATE public.boleta_maestro m SET maestro_idioma = 'en'
WHERE m.maestro_idioma IS NULL AND m.maestro_nivel = 3 AND EXISTS (
  SELECT 1 FROM public.boleta_maestro_grupo g
  JOIN public.boleta_materia mt ON mt.materia_id = g.materia_id
  WHERE g.maestro_id = m.maestro_id AND mt.materia_nombre = 'Teacher'
);

UPDATE public.boleta_maestro m SET maestro_idioma = 'es'
WHERE m.maestro_idioma IS NULL AND m.maestro_nivel = 3 AND EXISTS (
  SELECT 1 FROM public.boleta_maestro_grupo g
  JOIN public.boleta_materia mt ON mt.materia_id = g.materia_id
  WHERE g.maestro_id = m.maestro_id AND mt.materia_nombre = 'Maestro(a)'
);
