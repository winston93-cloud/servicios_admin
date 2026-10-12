-- Boletas visibles para papás en el portal: cada coordinación publica su módulo por trimestre.
-- Sin fila = el trimestre no se ve en el portal (los maestros pueden seguir capturando).
CREATE TABLE IF NOT EXISTS public.boleta_publicacion (
  ciclo smallint NOT NULL,
  modulo text NOT NULL CHECK (modulo IN ('kinder-es', 'kinder-en', 'primaria-es', 'primaria-en', 'secundaria')),
  trimestre smallint NOT NULL CHECK (trimestre BETWEEN 1 AND 3),
  publicada_por text NOT NULL,
  publicada_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ciclo, modulo, trimestre)
);

ALTER TABLE public.boleta_publicacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_publicacion FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_publicacion;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_publicacion
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_publicacion FROM anon, authenticated;

-- Video del portal de boletas para papás, por ciclo (`ciclos_escolares.valor`). Vacío = no se muestra.
CREATE TABLE IF NOT EXISTS public.boleta_portal_config (
  ciclo smallint PRIMARY KEY,
  video_url text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boleta_portal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_portal_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_portal_config;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_portal_config
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_portal_config FROM anon, authenticated;
