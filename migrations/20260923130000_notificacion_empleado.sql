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
