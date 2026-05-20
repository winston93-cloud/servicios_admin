-- =============================================================================
-- concepto_interno (MySQL winston_general → Supabase)
-- Catálogo de conceptos para pagos internos.
--
-- Importar CSV:
--   node scripts/fix-concepto-interno-csv.mjs ruta/concepto_interno.csv
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.concepto_interno (
  concepto_id SMALLINT PRIMARY KEY,
  concepto_clase VARCHAR(30),
  visible SMALLINT NOT NULL DEFAULT 1,
  orden_visible SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.concepto_interno IS 'Conceptos de pago interno (legacy concepto_interno).';
COMMENT ON COLUMN public.concepto_interno.visible IS '1 = visible en listados del sistema legacy.';
COMMENT ON COLUMN public.concepto_interno.orden_visible IS 'Orden de aparición en selects.';

CREATE INDEX IF NOT EXISTS concepto_interno_visible ON public.concepto_interno (visible);

-- SELECT setval(pg_get_serial_sequence('public.concepto_interno','concepto_id'), ...) no aplica (PK manual).
