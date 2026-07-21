-- Completar pago_prorroga en Winston Servicios (esquema legacy completo).
-- La tabla stub solo tenía prorroga_id, alumno_id, prorroga_fecha, correccion.

ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS alumno_ref INTEGER;
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS pago_concepto SMALLINT;
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS pago_importe NUMERIC(10, 2);
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS prorroga_status SMALLINT DEFAULT 1;
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS prorroga_ciclo_escolar SMALLINT;
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS prorroga_no INTEGER;
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS prorroga_registro TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pago_prorroga ADD COLUMN IF NOT EXISTS autor VARCHAR(50) DEFAULT '';

CREATE INDEX IF NOT EXISTS pago_prorroga_alumno_ciclo
  ON public.pago_prorroga (alumno_id, prorroga_ciclo_escolar);
CREATE INDEX IF NOT EXISTS pago_prorroga_alumno_ref
  ON public.pago_prorroga (alumno_ref);
CREATE INDEX IF NOT EXISTS pago_prorroga_status_ciclo
  ON public.pago_prorroga (prorroga_status, prorroga_ciclo_escolar);
