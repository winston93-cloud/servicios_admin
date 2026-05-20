-- =============================================================================
-- concepto_boucher (MySQL winston_general → Supabase)
-- Conceptos de pago de colegiatura / inscripción (referencia de 12 dígitos).
--
-- Importar CSV:
--   node scripts/fix-concepto-boucher-csv.mjs ruta/concepto_boucher.csv
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.concepto_boucher (
  concepto_id SMALLINT PRIMARY KEY,
  concepto_no CHAR(2) NOT NULL,
  concepto_clase VARCHAR(100) NOT NULL,
  alumno_nivel SMALLINT NOT NULL DEFAULT 0,
  concepto_tipo SMALLINT NOT NULL,
  concepto_descuento SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.concepto_boucher IS 'Catálogo de conceptos para pagos de colegiatura (legacy concepto_boucher).';
COMMENT ON COLUMN public.concepto_boucher.concepto_no IS '2 dígitos en posiciones 6-7 de pago_referencia.';
COMMENT ON COLUMN public.concepto_boucher.concepto_tipo IS '1=Inscripción, 2=Colegiatura, 3=Otro.';

CREATE UNIQUE INDEX IF NOT EXISTS concepto_boucher_concepto_no_unique ON public.concepto_boucher (concepto_no);
