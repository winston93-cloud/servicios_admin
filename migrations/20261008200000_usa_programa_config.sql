-- Winston USA Program: datos por ciclo para el portal (p. ej. video explicativo de Marketing). Vacío = no se muestra.
CREATE TABLE IF NOT EXISTS public.usa_programa_config (
  precio_ciclo_escolar smallint PRIMARY KEY,
  video_url text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usa_programa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usa_programa_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.usa_programa_config;
CREATE POLICY servicios_insforge_deny_anon ON public.usa_programa_config
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.usa_programa_config FROM anon, authenticated;
