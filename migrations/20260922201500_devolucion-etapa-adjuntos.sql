-- Etapa 2: adjuntos (facturas / notas de crédito) + avance de proceso

ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS etapa SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS slack_admvo_ok BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS slack_admvo_error TEXT;

ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS etapa2_at TIMESTAMPTZ;

ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS etapa2_por VARCHAR(160);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'devolucion_tarjeta_etapa_check'
  ) THEN
    ALTER TABLE public.devolucion_tarjeta
      ADD CONSTRAINT devolucion_tarjeta_etapa_check CHECK (etapa BETWEEN 1 AND 4);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.devolucion_tarjeta_adjunto (
  id SERIAL PRIMARY KEY,
  devolucion_id INT NOT NULL REFERENCES public.devolucion_tarjeta(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL DEFAULT '',
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
  bytes INT NOT NULL DEFAULT 0,
  subido_por VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devolucion_adjunto_dev
  ON public.devolucion_tarjeta_adjunto (devolucion_id, created_at DESC);

ALTER TABLE public.devolucion_tarjeta_adjunto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucion_tarjeta_adjunto FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.devolucion_tarjeta_adjunto;
CREATE POLICY servicios_insforge_deny_anon ON public.devolucion_tarjeta_adjunto
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.devolucion_tarjeta_adjunto FROM anon, authenticated;
