-- =============================================================================
-- pago_prorroga (MySQL winston_general → Supabase)
-- Prórrogas de pago por alumno (módulo suspensiones / prórrogas).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pago_prorroga (
  prorroga_id INTEGER PRIMARY KEY,
  alumno_id INTEGER NOT NULL,
  prorroga_fecha DATE NOT NULL,
  correccion SMALLINT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.pago_prorroga IS 'Prórrogas de pago vigentes por alumno (legacy pago_prorroga).';

CREATE INDEX IF NOT EXISTS pago_prorroga_alumno ON public.pago_prorroga (alumno_id);
CREATE INDEX IF NOT EXISTS pago_prorroga_fecha ON public.pago_prorroga (prorroga_fecha);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_prorroga_alumno_id_fkey'
  ) THEN
    ALTER TABLE public.pago_prorroga
      ADD CONSTRAINT pago_prorroga_alumno_id_fkey
      FOREIGN KEY (alumno_id) REFERENCES public.alumno (alumno_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
