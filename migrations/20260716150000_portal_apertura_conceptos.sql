-- Apertura en portal de pagos: Cambridge y Doble titulación (fila única id=1).

CREATE TABLE IF NOT EXISTS public.portal_apertura_conceptos (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cambridge_abierto boolean NOT NULL DEFAULT false,
  doble_titulacion_abierto boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_por text
);

INSERT INTO public.portal_apertura_conceptos (id, cambridge_abierto, doble_titulacion_abierto)
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.portal_apertura_conceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_apertura_conceptos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.portal_apertura_conceptos;
CREATE POLICY servicios_insforge_deny_anon ON public.portal_apertura_conceptos
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.portal_apertura_conceptos FROM anon, authenticated;
