-- Pago anual de colegiaturas (concepto_no 30) + activación por alumno/ciclo.

INSERT INTO public.concepto_boucher (
  concepto_id, concepto_no, concepto_clase, alumno_nivel, concepto_tipo, concepto_descuento
) VALUES (
  31, '30', 'Pago Anual', 0, 2, 1
)
ON CONFLICT (concepto_id) DO UPDATE SET
  concepto_no = EXCLUDED.concepto_no,
  concepto_clase = EXCLUDED.concepto_clase,
  concepto_tipo = EXCLUDED.concepto_tipo,
  concepto_descuento = EXCLUDED.concepto_descuento;

CREATE TABLE IF NOT EXISTS public.alumno_pago_anual (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  plan_meses smallint NOT NULL CHECK (plan_meses IN (1, 2)),
  monto numeric(12, 2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  pagado boolean NOT NULL DEFAULT false,
  vencimiento date NOT NULL,
  activado_en timestamptz NOT NULL DEFAULT now(),
  pagado_en timestamptz NULL,
  desactivado_en timestamptz NULL,
  desactivado_motivo text NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS alumno_pago_anual_ciclo_idx
  ON public.alumno_pago_anual (ciclo_valor);

CREATE INDEX IF NOT EXISTS alumno_pago_anual_activo_idx
  ON public.alumno_pago_anual (activo, pagado, vencimiento);

ALTER TABLE public.alumno_pago_anual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_pago_anual FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_pago_anual;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_pago_anual
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_pago_anual FROM anon, authenticated;
