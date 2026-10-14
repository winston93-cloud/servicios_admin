-- Trimestre abierto a captura de maestros por ciclo y módulo (legacy boleta_bimestre; 0 = captura cerrada).
-- Sin fila = cerrada: la dirección abre el trimestre cuando arranca la captura.

CREATE TABLE IF NOT EXISTS public.boleta_captura_periodo (
  ciclo smallint NOT NULL,
  modulo text NOT NULL,
  trimestre smallint NOT NULL DEFAULT 0 CHECK (trimestre BETWEEN 0 AND 3),
  actualizado_por text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ciclo, modulo)
);

ALTER TABLE public.boleta_captura_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_captura_periodo FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_captura_periodo;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_captura_periodo
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_captura_periodo FROM anon, authenticated;
