-- Bitácora de accesos al dashboard: quién autorizó, qué sistema, cuándo y quién lo operó.
CREATE TABLE IF NOT EXISTS public.usuario_acceso_bitacora (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  modulo_id VARCHAR(60) NOT NULL,
  accion VARCHAR(10) NOT NULL CHECK (accion IN ('otorgado', 'retirado')),
  autorizado_por VARCHAR(160) NOT NULL,
  operado_por_id INTEGER,
  operado_por VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuario_acceso_bitacora_usuario
  ON public.usuario_acceso_bitacora (usuario_id, created_at DESC);
