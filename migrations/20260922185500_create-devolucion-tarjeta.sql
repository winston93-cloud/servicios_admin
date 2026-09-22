-- Devoluciones de pagos con tarjeta (autorización Slack + historial verificable)

CREATE TABLE IF NOT EXISTS public.devolucion_tarjeta (
  id SERIAL PRIMARY KEY,
  asunto VARCHAR(255) NOT NULL DEFAULT '',
  realizado_por VARCHAR(160) NOT NULL,
  usuario_id INT,
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL DEFAULT '',
  mime_type VARCHAR(120) NOT NULL DEFAULT 'image/png',
  slack_ok BOOLEAN NOT NULL DEFAULT FALSE,
  slack_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devolucion_tarjeta_created
  ON public.devolucion_tarjeta (created_at DESC);

ALTER TABLE public.devolucion_tarjeta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucion_tarjeta FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.devolucion_tarjeta;
CREATE POLICY servicios_insforge_deny_anon ON public.devolucion_tarjeta
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.devolucion_tarjeta FROM anon, authenticated;
