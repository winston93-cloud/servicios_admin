-- Segundo escalón del aviso de inscripción sin pagar: control escolar a los 15 días, directoras a los 45.
-- `alertado_at` sigue siendo el de control escolar; `direccion_alertado_at` el de las directoras (null = aún no).
ALTER TABLE public.inscripcion_alerta_sin_pago
  ADD COLUMN IF NOT EXISTS direccion_alertado_at timestamptz;
