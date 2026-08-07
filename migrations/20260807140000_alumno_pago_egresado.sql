-- Acceso temporal al portal para egresados (baja general) que liquidan adeudos
-- del ciclo en que terminaron. No altera alumno_status ni alumno_grado.

CREATE TABLE IF NOT EXISTS public.alumno_pago_egresado (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  con_recargos boolean NOT NULL DEFAULT true,
  activado_en timestamptz NOT NULL DEFAULT now(),
  desactivado_en timestamptz NULL,
  desactivado_motivo text NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS alumno_pago_egresado_activo_idx
  ON public.alumno_pago_egresado (activo)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS alumno_pago_egresado_ciclo_idx
  ON public.alumno_pago_egresado (ciclo_valor);

ALTER TABLE public.alumno_pago_egresado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_pago_egresado FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_pago_egresado;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_pago_egresado
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_pago_egresado FROM anon, authenticated;
