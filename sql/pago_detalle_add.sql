-- =============================================================================
-- pago_detalle (MySQL winston_general → Supabase)
-- Pagos de colegiatura confirmados (Openpay, comercio electrónico, etc.).
--
-- pago_referencia (12 dígitos): ref(5) + concepto_no(2) + ciclo(2) + verificador(3)
--
-- Importar CSV:
--   node scripts/fix-pago-detalle-csv.mjs ruta/pago_detalle.csv
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_pago_detalle_actualizacion_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pago_actualizacion := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.pago_detalle (
  pago_id INTEGER PRIMARY KEY,
  alumno_id INTEGER,
  pago_nombre VARCHAR(100),
  pago_referencia CHAR(12),
  pago_importe NUMERIC(7, 2) NOT NULL,
  pago_recargo NUMERIC(6, 2) NOT NULL DEFAULT 0,
  pago_forma VARCHAR(30),
  pago_folio VARCHAR(25),
  pago_fecha DATE,
  pago_hora VARCHAR(15),
  pago_emisora VARCHAR(10),
  pago_cancelado SMALLINT NOT NULL DEFAULT 0,
  pago_registro TIMESTAMP,
  pago_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  facturo VARCHAR(2) NOT NULL DEFAULT '',
  fact VARCHAR(2) NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.pago_detalle IS 'Detalle de pagos de colegiatura (legacy pago_detalle).';
COMMENT ON COLUMN public.pago_detalle.pago_cancelado IS '0=vigente, 1=cancelado, 2=devolución, 3=agregado manual (legacy).';

CREATE INDEX IF NOT EXISTS pago_detalle_alumno_id ON public.pago_detalle (alumno_id);
CREATE INDEX IF NOT EXISTS pago_detalle_referencia ON public.pago_detalle (pago_referencia);
CREATE INDEX IF NOT EXISTS pago_detalle_fecha ON public.pago_detalle (pago_fecha);

DROP TRIGGER IF EXISTS trg_pago_detalle_actualizacion ON public.pago_detalle;
CREATE TRIGGER trg_pago_detalle_actualizacion
  BEFORE UPDATE ON public.pago_detalle
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pago_detalle_actualizacion_timestamp();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_detalle_alumno_id_fkey'
  ) THEN
    ALTER TABLE public.pago_detalle
      ADD CONSTRAINT pago_detalle_alumno_id_fkey
      FOREIGN KEY (alumno_id) REFERENCES public.alumno (alumno_id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SELECT setval(
--   pg_get_serial_sequence('public.pago_detalle', 'pago_id'),
--   COALESCE((SELECT MAX(pago_id) FROM public.pago_detalle), 1)
-- );
