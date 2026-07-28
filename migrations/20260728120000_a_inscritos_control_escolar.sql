-- Control Escolar: autorización de documentación completa (nuevo ingreso).
-- Equivalente legacy MySQL `a_inscritos`. El portal desbloquea el recibo final
-- cuando existe una fila con `ctrl` = últimos 5 dígitos de alumno_ref.

CREATE TABLE IF NOT EXISTS public.a_inscritos (
  id bigserial PRIMARY KEY,
  codigo text,
  fecha text,
  ctrl text NOT NULL,
  nombre text,
  estatus text NOT NULL DEFAULT 'Documentos Completos',
  autorizado_por text,
  autorizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS a_inscritos_ctrl_uidx
  ON public.a_inscritos (ctrl);

CREATE INDEX IF NOT EXISTS a_inscritos_autorizado_en_idx
  ON public.a_inscritos (autorizado_en DESC);

ALTER TABLE public.a_inscritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.a_inscritos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.a_inscritos;
CREATE POLICY servicios_insforge_deny_anon ON public.a_inscritos
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.a_inscritos FROM anon, authenticated;
