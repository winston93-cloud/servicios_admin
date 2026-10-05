-- 2026-10-05 — Familia Winston: validación automática del comprobante (QR) en el portal.
-- Al validar se condona la próxima colegiatura pendiente del alumno que recomendó (ctrl)
-- y se guarda aquí quién validó, a qué alumno se recomendó y qué pago se registró.

-- Inicio de clases por ciclo (regla: el recomendado debe llevar 30 días de clases).
ALTER TABLE public.ciclos_escolares
  ADD COLUMN IF NOT EXISTS inicio_clases date;

UPDATE public.ciclos_escolares
SET inicio_clases = DATE '2026-08-03'
WHERE valor = 23 AND inicio_clases IS NULL;

ALTER TABLE public.wsp
  ADD COLUMN IF NOT EXISTS referido_alumno_ref integer,
  ADD COLUMN IF NOT EXISTS validado_en timestamptz,
  ADD COLUMN IF NOT EXISTS validado_por text,
  ADD COLUMN IF NOT EXISTS pago_id integer,
  ADD COLUMN IF NOT EXISTS pago_referencia text,
  ADD COLUMN IF NOT EXISTS concepto_condonado text,
  ADD COLUMN IF NOT EXISTS ciclo_condonado smallint,
  ADD COLUMN IF NOT EXISTS correo_enviado_en timestamptz,
  ADD COLUMN IF NOT EXISTS correo_resultado text;

-- Un alumno recomendado solo puede generar un beneficio.
CREATE UNIQUE INDEX IF NOT EXISTS wsp_referido_unico
  ON public.wsp (referido_alumno_ref)
  WHERE referido_alumno_ref IS NOT NULL AND status IN ('aplicando', 'autorizado');
