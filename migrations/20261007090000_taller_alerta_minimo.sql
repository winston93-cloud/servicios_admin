-- Talleres: grupos que ya se avisaron por estar en su cupo mínimo (inscritos ≤ cupo_min).
-- Fila presente = aviso abierto (correo + notificación ya enviados). Se borra cuando el grupo sale del mínimo,
-- para volver a avisar si vuelve a caer. La PK evita avisos duplicados entre peticiones simultáneas.

CREATE TABLE IF NOT EXISTS public.taller_alerta_minimo (
  asignacion_id integer PRIMARY KEY REFERENCES public.taller_asignacion (id) ON DELETE CASCADE,
  ciclo_escolar smallint NOT NULL,
  inscritos integer NOT NULL,
  cupo_min integer NOT NULL,
  alertado_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taller_alerta_minimo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taller_alerta_minimo FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.taller_alerta_minimo;
CREATE POLICY servicios_insforge_deny_anon ON public.taller_alerta_minimo
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.taller_alerta_minimo FROM anon, authenticated;
