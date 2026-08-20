-- Archivo de pagos internos legacy (fuera del talón actual).
-- Misma estructura que public.pago_interno + archivado_en.

CREATE TABLE IF NOT EXISTS public.pago_interno_old (
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
  pago_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archivado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.pago_interno_old IS
  'Archivo de pago_interno legacy (folios >=4000, talon 26550+, 3480-3999, y 3200-3479 pre-2026).';

CREATE INDEX IF NOT EXISTS pago_interno_old_folio ON public.pago_interno_old (pago_folio);
CREATE INDEX IF NOT EXISTS pago_interno_old_fecha ON public.pago_interno_old (pago_fecha);
CREATE INDEX IF NOT EXISTS pago_interno_old_alumno ON public.pago_interno_old (alumno_id);
