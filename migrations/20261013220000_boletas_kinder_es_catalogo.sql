-- Boletas Kinder Español: catálogo editable de campos académicos por grado (K1–K3).
-- Los ids son los mismos fk_materia del legacy boletasek (boleta_calificacionpke) y los que ya usa
-- boleta_calificacion_kinder_es.indicador_id. Nombres como en las plantillas 2025-2026.

CREATE TABLE IF NOT EXISTS public.boleta_kinder_es_indicador (
  grado smallint NOT NULL CHECK (grado BETWEEN 1 AND 3),
  indicador_id integer NOT NULL CHECK (indicador_id > 0),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  orden smallint NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grado, indicador_id)
);

INSERT INTO public.boleta_kinder_es_indicador (grado, indicador_id, nombre, orden)
VALUES
  (1, 1, 'Identificación de colores', 1),
  (1, 2, 'Ubicación espacial', 2),
  (1, 3, 'Identificación de líneas', 3),
  (1, 4, 'Identificación de figuras geométricas', 4),
  (1, 5, 'Identificación de números', 5),
  (1, 6, 'Identificación de vocales', 6),
  (1, 7, 'Ritmo y secuencia al contar', 7),
  (1, 8, 'Proyectos', 8),
  (1, 9, 'Trabajo en clase', 9),
  (1, 10, 'Tareas', 10),
  (1, 11, 'Conducta', 11),
  (1, 12, 'EXAMEN ESPAÑOL', 12),
  (1, 13, 'EXAMEN MATEMÁTICAS', 13),
  (1, 14, 'Educación Física', 14),
  (2, 15, 'Identificación de colores', 1),
  (2, 16, 'Identificación de vocales', 2),
  (2, 17, 'Identificación de líneas', 3),
  (2, 18, 'Diptongos', 4),
  (2, 19, 'Consonantes', 5),
  (2, 20, 'Sílabas', 6),
  (2, 21, 'Identificación de números', 7),
  (2, 22, 'Palabras sencillas', 8),
  (2, 23, 'Conteo', 9),
  (2, 24, 'Ubicación espacial', 10),
  (2, 25, 'Figuras geométricas', 11),
  (2, 26, 'Sumas', 12),
  (2, 27, 'Restas', 13),
  (2, 28, 'Proyectos', 14),
  (2, 29, 'Lectura de sílabas y palabras sencillas', 15),
  (2, 30, 'Tareas', 16),
  (2, 31, 'EXAMEN ESPAÑOL', 17),
  (2, 32, 'EXAMEN MATEMÁTICAS', 18),
  (2, 33, 'Trabajo en clase', 19),
  (2, 34, 'Conducta', 20),
  (2, 35, 'Tecnología', 21),
  (2, 36, 'Educación Física', 22),
  (3, 37, 'Escritura (trazo)', 1),
  (3, 38, 'Lectura (fluidez)', 2),
  (3, 39, 'Lectura (comprensión)', 3),
  (3, 40, 'Identificación del abecedario', 4),
  (3, 41, 'Dictado', 5),
  (3, 42, 'Sumas', 6),
  (3, 43, 'Restas', 7),
  (3, 44, 'Figuras geométricas', 8),
  (3, 45, 'Problemas razonados', 9),
  (3, 46, 'Identificación de números', 10),
  (3, 47, 'Unidades - decenas', 11),
  (3, 48, 'Números antecesor y sucesor', 12),
  (3, 49, 'Secuencias numéricas', 13),
  (3, 50, 'Proyectos', 14),
  (3, 51, 'EXAMEN ESPAÑOL', 15),
  (3, 52, 'EXAMEN MATEMÁTICAS', 16),
  (3, 53, 'Tareas', 17),
  (3, 54, 'Trabajo en clase', 18),
  (3, 55, 'Conducta', 19),
  (3, 56, 'Tecnología', 20),
  (3, 57, 'Robótica', 21),
  (3, 58, 'Educación Física', 22)
ON CONFLICT (grado, indicador_id) DO NOTHING;

ALTER TABLE public.boleta_kinder_es_indicador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_kinder_es_indicador FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_kinder_es_indicador;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_kinder_es_indicador
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_kinder_es_indicador FROM anon, authenticated;
