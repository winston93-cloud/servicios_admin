-- Cargo extra de horario extendido ($300/mes en colegiaturas mensuales, por alumno/ciclo).

CREATE TABLE IF NOT EXISTS public.alumno_cargo_extra (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  monto numeric(12, 2) NOT NULL DEFAULT 300,
  activo boolean NOT NULL DEFAULT true,
  activado_en timestamptz NOT NULL DEFAULT now(),
  desactivado_en timestamptz NULL,
  desactivado_motivo text NULL,
  activado_por text NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS alumno_cargo_extra_ciclo_idx
  ON public.alumno_cargo_extra (ciclo_valor);

CREATE INDEX IF NOT EXISTS alumno_cargo_extra_activo_idx
  ON public.alumno_cargo_extra (activo, ciclo_valor);

ALTER TABLE public.alumno_cargo_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_cargo_extra FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_cargo_extra;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_cargo_extra
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_cargo_extra FROM anon, authenticated;
