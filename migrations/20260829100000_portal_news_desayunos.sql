-- News y menú desayunos/comidas — metadata + InsForge Storage (bucket portal-news-desayunos)

CREATE TABLE IF NOT EXISTS public.portal_news_desayunos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('news', 'desayunos')),
  anio INT NOT NULL,
  mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL DEFAULT '',
  nombre_archivo VARCHAR(255),
  mime_type VARCHAR(120) NOT NULL DEFAULT 'application/pdf',
  creado_por VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portal_news_desayunos_tipo_mes_unique UNIQUE (tipo, anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_portal_news_desayunos_periodo
  ON public.portal_news_desayunos (anio DESC, mes DESC);

ALTER TABLE public.portal_news_desayunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_news_desayunos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.portal_news_desayunos;
CREATE POLICY servicios_insforge_deny_anon ON public.portal_news_desayunos
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.portal_news_desayunos FROM anon, authenticated;
