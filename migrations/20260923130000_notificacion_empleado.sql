CREATE TABLE IF NOT EXISTS public.notificacion_empleado (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  asunto VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  devolucion_id INTEGER,
  cheque_numero INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_empleado_usuario_leida
  ON public.notificacion_empleado (usuario_id, leida, created_at DESC);

ALTER TABLE public.devolucion_tarjeta ADD COLUMN IF NOT EXISTS etapa5_at TIMESTAMPTZ;
ALTER TABLE public.devolucion_tarjeta ADD COLUMN IF NOT EXISTS etapa5_por VARCHAR(160);

ALTER TABLE public.devolucion_tarjeta DROP CONSTRAINT IF EXISTS devolucion_tarjeta_etapa_check;
ALTER TABLE public.devolucion_tarjeta
  ADD CONSTRAINT devolucion_tarjeta_etapa_check CHECK (etapa >= 1 AND etapa <= 5);
