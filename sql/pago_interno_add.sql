-- =============================================================================
-- pago_interno (MySQL winston_general → Supabase)
-- Registro de pagos internos por alumno.
--
-- Importar CSV:
--   node scripts/fix-pago-interno-csv.mjs ruta/pago_interno.csv
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_pago_interno_actualizacion_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pago_actualizacion := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.pago_interno (
  pago_id INTEGER PRIMARY KEY,
  alumno_id INTEGER,
  concepto_id SMALLINT NOT NULL,
  concepto_otro VARCHAR(50),
  pago_folio INTEGER NOT NULL,
  pago_importe NUMERIC(6, 2) NOT NULL,
  pago_fecha DATE,
  pago_cancelado SMALLINT NOT NULL DEFAULT 0,
  pago_ciclo_escolar SMALLINT,
  pago_registro TIMESTAMP,
  pago_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.pago_interno IS 'Pagos internos registrados (legacy pago_interno).';
COMMENT ON COLUMN public.pago_interno.concepto_otro IS 'Texto extra al concepto (legacy concepto_otro).';
COMMENT ON COLUMN public.pago_interno.pago_cancelado IS '0 = vigente; distinto de 0 = cancelado.';

CREATE INDEX IF NOT EXISTS pago_interno_alumno_id ON public.pago_interno (alumno_id);
CREATE INDEX IF NOT EXISTS pago_interno_concepto_id ON public.pago_interno (concepto_id);
CREATE INDEX IF NOT EXISTS pago_interno_ciclo ON public.pago_interno (pago_ciclo_escolar);
CREATE INDEX IF NOT EXISTS pago_interno_folio ON public.pago_interno (pago_folio);

DROP TRIGGER IF EXISTS trg_pago_interno_actualizacion ON public.pago_interno;
CREATE TRIGGER trg_pago_interno_actualizacion
  BEFORE UPDATE ON public.pago_interno
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pago_interno_actualizacion_timestamp();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_interno_alumno_id_fkey'
  ) THEN
    ALTER TABLE public.pago_interno
      ADD CONSTRAINT pago_interno_alumno_id_fkey
      FOREIGN KEY (alumno_id) REFERENCES public.alumno (alumno_id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_interno_concepto_id_fkey'
  ) THEN
    ALTER TABLE public.pago_interno
      ADD CONSTRAINT pago_interno_concepto_id_fkey
      FOREIGN KEY (concepto_id) REFERENCES public.concepto_interno (concepto_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- SELECT setval(
--   pg_get_serial_sequence('public.pago_interno', 'pago_id'),
--   COALESCE((SELECT MAX(pago_id) FROM public.pago_interno), 1)
-- );
