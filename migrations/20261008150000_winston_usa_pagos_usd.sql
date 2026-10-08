-- Winston USA Program (conceptos 23/24/25): monto en USD y fecha desde la que el pago aparece en el portal.
-- Una fila por ciclo y pago. Sin filas para un ciclo → se cobra como antes (pesos de pago_boucher_precio).
CREATE TABLE IF NOT EXISTS public.usa_programa_pago (
  precio_ciclo_escolar smallint NOT NULL,
  pago smallint NOT NULL CHECK (pago BETWEEN 1 AND 3),
  monto_usd numeric(10,2) NOT NULL DEFAULT 0 CHECK (monto_usd >= 0),
  fecha_apertura date NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (precio_ciclo_escolar, pago)
);

-- Tipo de cambio USD→MXN aplicable cada día (serie Banxico "para solventar obligaciones", la del DOF).
-- Se guarda la primera consulta del día para que el monto no cambie a media jornada.
CREATE TABLE IF NOT EXISTS public.tipo_cambio_usd_mxn (
  fecha date PRIMARY KEY,
  usd_mxn numeric(10,4) NOT NULL CHECK (usd_mxn > 0),
  fecha_dato date NOT NULL,
  fuente text NOT NULL,
  consultado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usa_programa_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usa_programa_pago FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.usa_programa_pago;
CREATE POLICY servicios_insforge_deny_anon ON public.usa_programa_pago
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.usa_programa_pago FROM anon, authenticated;

ALTER TABLE public.tipo_cambio_usd_mxn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_cambio_usd_mxn FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.tipo_cambio_usd_mxn;
CREATE POLICY servicios_insforge_deny_anon ON public.tipo_cambio_usd_mxn
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.tipo_cambio_usd_mxn FROM anon, authenticated;

-- Ciclo actual: 100 / 125 / 125 USD, se abren el 15 de octubre, noviembre y diciembre.
INSERT INTO public.usa_programa_pago (precio_ciclo_escolar, pago, monto_usd, fecha_apertura)
SELECT c.valor, p.pago, p.usd, make_date(c.anio_inicio, p.mes, 15)
FROM public.ciclos_escolares c
CROSS JOIN (VALUES (1, 100.00, 10), (2, 125.00, 11), (3, 125.00, 12)) AS p(pago, usd, mes)
WHERE c.es_actual
ON CONFLICT DO NOTHING;
