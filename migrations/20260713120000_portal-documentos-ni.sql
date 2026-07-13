-- Expediente digital NI: envíos de documentos PDF a control escolar por nivel

CREATE TABLE IF NOT EXISTS public.portal_documentos_ni (
  id bigserial PRIMARY KEY,
  alumno_id integer NOT NULL,
  alumno_ref integer NOT NULL,
  ciclo_valor integer NOT NULL,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 4),
  correo_destino text NOT NULL,
  documentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_id text,
  enviado_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_documentos_ni_alumno_ciclo_idx
  ON public.portal_documentos_ni (alumno_id, ciclo_valor DESC);

CREATE INDEX IF NOT EXISTS portal_documentos_ni_ciclo_idx
  ON public.portal_documentos_ni (ciclo_valor);

ALTER TABLE public.portal_documentos_ni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_documentos_ni FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.portal_documentos_ni;
CREATE POLICY servicios_insforge_deny_anon ON public.portal_documentos_ni
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.portal_documentos_ni FROM anon, authenticated;
