-- Plan de colegiaturas (10/11 meses) por ciclo escolar.
-- Independiente de alumno.mes, que legacy trata como un solo valor global.

CREATE TABLE IF NOT EXISTS public.alumno_plan_meses (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  mes smallint NOT NULL CHECK (mes IN (1, 2)),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS alumno_plan_meses_ciclo_idx
  ON public.alumno_plan_meses (ciclo_valor);

ALTER TABLE public.alumno_plan_meses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_plan_meses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_plan_meses;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_plan_meses
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_plan_meses FROM anon, authenticated;
