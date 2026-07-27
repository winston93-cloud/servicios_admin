-- Progreso de pasos de inscripción del portal (multi-dispositivo).
-- Reglamento / recibo final / plan dejan de depender solo de localStorage.

CREATE TABLE IF NOT EXISTS public.portal_inscripcion_progreso (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  reglamento_visto boolean NOT NULL DEFAULT false,
  recibo_final_visto boolean NOT NULL DEFAULT false,
  plan_confirmado boolean NOT NULL DEFAULT false,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS portal_inscripcion_progreso_ciclo_idx
  ON public.portal_inscripcion_progreso (ciclo_valor);

ALTER TABLE public.portal_inscripcion_progreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_inscripcion_progreso FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.portal_inscripcion_progreso;
CREATE POLICY servicios_insforge_deny_anon ON public.portal_inscripcion_progreso
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.portal_inscripcion_progreso FROM anon, authenticated;
