-- Paquete de colegiaturas (concepto_no 31): meses elegidos, un solo cobro.

INSERT INTO public.concepto_boucher (
  concepto_id, concepto_no, concepto_clase, alumno_nivel, concepto_tipo, concepto_descuento
) VALUES (
  32, '31', 'Pagos de Colegiaturas', 0, 2, 0
)
ON CONFLICT (concepto_id) DO UPDATE SET
  concepto_no = EXCLUDED.concepto_no,
  concepto_clase = EXCLUDED.concepto_clase,
  concepto_tipo = EXCLUDED.concepto_tipo,
  concepto_descuento = EXCLUDED.concepto_descuento;

CREATE TABLE IF NOT EXISTS public.alumno_pago_colegiaturas (
  alumno_id integer NOT NULL REFERENCES public.alumno (alumno_id),
  ciclo_valor integer NOT NULL,
  plan_meses smallint NOT NULL CHECK (plan_meses IN (1, 2)),
  conceptos text[] NOT NULL,
  monto numeric(12, 2) NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  pagado boolean NOT NULL DEFAULT false,
  activado_en timestamptz NOT NULL DEFAULT now(),
  pagado_en timestamptz NULL,
  desactivado_en timestamptz NULL,
  desactivado_motivo text NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS alumno_pago_colegiaturas_ciclo_idx
  ON public.alumno_pago_colegiaturas (ciclo_valor);

CREATE INDEX IF NOT EXISTS alumno_pago_colegiaturas_activo_idx
  ON public.alumno_pago_colegiaturas (activo, pagado);

ALTER TABLE public.alumno_pago_colegiaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_pago_colegiaturas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_pago_colegiaturas;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_pago_colegiaturas
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_pago_colegiaturas FROM anon, authenticated;
