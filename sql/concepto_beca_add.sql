-- =============================================================================
-- Catálogo concepto_beca (MySQL winston_general → Supabase)
-- Tipos de beca referenciados por alumno_beca.beca_id
--
-- Ejecutar en Supabase SQL Editor (Run without RLS, como alumno_beca).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.concepto_beca (
  beca_id SMALLINT PRIMARY KEY,
  beca_clase VARCHAR(20) NOT NULL
);

COMMENT ON TABLE public.concepto_beca IS 'Catálogo de tipos de beca (legacy concepto_beca).';
COMMENT ON COLUMN public.concepto_beca.beca_clase IS 'Nombre del concepto (ej. Pemex, Winston, Hermanos 20).';

-- Datos legacy (17 filas, beca_id 1–17)
INSERT INTO public.concepto_beca (beca_id, beca_clase) VALUES
  (1, 'Pemex'),
  (2, '*'),
  (3, 'Winston'),
  (4, 'Promedio'),
  (5, 'Docencia'),
  (6, 'Excelencia'),
  (7, 'Familiar'),
  (8, 'Académica'),
  (9, 'Socioeconómica'),
  (10, 'Hermanos 20'),
  (11, 'Grupal'),
  (12, 'Exalumno'),
  (13, 'Hermanos 15'),
  (14, 'Vecinos'),
  (15, 'IMSS'),
  (16, 'CFE'),
  (17, 'TELMEX')
ON CONFLICT (beca_id) DO UPDATE SET beca_clase = EXCLUDED.beca_clase;

-- Opcional: enlazar alumno_beca → concepto_beca (solo si todos los beca_id existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alumno_beca_beca_id_fkey'
  ) THEN
    ALTER TABLE public.alumno_beca
      ADD CONSTRAINT alumno_beca_beca_id_fkey
      FOREIGN KEY (beca_id) REFERENCES public.concepto_beca (beca_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Verificación:
-- SELECT * FROM public.concepto_beca ORDER BY beca_id;
