-- Panel de control con enfoque de infraestructura: cada pieza (Banorte, Openpay, PAC, correo, Google, Storage…)
-- anota sus operaciones (ok + milisegundos) y cada tarea programada su último latido. Solo fallos del sistema
-- cuentan como `ok = false` (red, tiempo agotado, 5xx, credenciales); errores de datos de terceros cuentan como ok.

CREATE TABLE IF NOT EXISTS public.panel_sonda_evento (
  id bigserial PRIMARY KEY,
  pieza text NOT NULL,
  ok boolean NOT NULL,
  ms integer NOT NULL DEFAULT 0,
  detalle text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS panel_sonda_evento_pieza_fecha ON public.panel_sonda_evento (pieza, creado_en DESC);

CREATE TABLE IF NOT EXISTS public.panel_latido (
  tarea text PRIMARY KEY,
  ultimo_intento timestamptz NOT NULL DEFAULT now(),
  ultimo_ok timestamptz,
  ok boolean NOT NULL,
  ms integer NOT NULL DEFAULT 0,
  detalle text
);

ALTER TABLE public.panel_sonda_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_sonda_evento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.panel_sonda_evento;
CREATE POLICY servicios_insforge_deny_anon ON public.panel_sonda_evento
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.panel_sonda_evento FROM anon, authenticated;

ALTER TABLE public.panel_latido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_latido FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.panel_latido;
CREATE POLICY servicios_insforge_deny_anon ON public.panel_latido
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.panel_latido FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.panel_control_metricas()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
piezas AS (
  SELECT
    e.pieza,
    count(*) AS ops,
    count(*) FILTER (WHERE NOT e.ok) AS fallos,
    round(avg(e.ms) FILTER (WHERE e.ok))::int AS ms_prom,
    (percentile_disc(0.95) WITHIN GROUP (ORDER BY e.ms))::int AS ms_p95,
    max(e.creado_en) AS ultimo,
    (array_agg(e.detalle ORDER BY e.creado_en DESC) FILTER (WHERE NOT e.ok))[1] AS ultimo_fallo
  FROM panel_sonda_evento e
  WHERE e.creado_en > now() - interval '24 hours'
  GROUP BY e.pieza
),
openpay AS (
  SELECT
    count(*) AS ops,
    count(*) FILTER (WHERE NOT ok) AS fallos,
    max(recibido_en) AS ultimo,
    (array_agg(mensaje ORDER BY recibido_en DESC) FILTER (WHERE NOT ok))[1] AS ultimo_fallo
  FROM openpay_webhook_log
  WHERE recibido_en > now() - interval '24 hours'
),
oh_edicion AS (
  SELECT edicion_open_house AS ed
  FROM inscripciones
  WHERE edicion_open_house IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
),
kommo AS (
  SELECT
    count(i.*) FILTER (WHERE i.created_at BETWEEN now() - interval '7 days' AND now() - interval '15 minutes') AS registros,
    count(i.*) FILTER (WHERE i.created_at BETWEEN now() - interval '7 days' AND now() - interval '15 minutes' AND EXISTS (
      SELECT 1 FROM kommo_lead_tracking k
      WHERE (coalesce(i.email, '') <> '' AND lower(k.email) = lower(i.email))
         OR (
           length(regexp_replace(coalesce(i.telefono, ''), '\D', '', 'g')) >= 10
           AND right(regexp_replace(coalesce(k.telefono, ''), '\D', '', 'g'), 10)
             = right(regexp_replace(i.telefono, '\D', '', 'g'), 10)
         )
    )) AS con_lead,
    count(i.*) FILTER (
      WHERE i.reminder_scheduled_for < now() - interval '2 hours' AND NOT coalesce(i.reminder_sent, false)
    ) AS recordatorios_atrasados,
    count(i.*) FILTER (WHERE i.reminder_sent_at > now() - interval '7 days') AS recordatorios_enviados_7d
  FROM inscripciones i
  JOIN oh_edicion e ON i.edicion_open_house = e.ed
)
SELECT jsonb_build_object(
  'piezas', coalesce((SELECT jsonb_object_agg(pieza, jsonb_build_object(
      'ops', ops, 'fallos', fallos, 'ms_prom', ms_prom, 'ms_p95', ms_p95, 'ultimo', ultimo, 'ultimo_fallo', ultimo_fallo
    )) FROM piezas), '{}'::jsonb),
  'openpay_webhook', (SELECT jsonb_build_object(
      'ops', ops, 'fallos', fallos, 'ultimo', ultimo, 'ultimo_fallo', ultimo_fallo
    ) FROM openpay),
  'latidos', coalesce((SELECT jsonb_object_agg(tarea, jsonb_build_object(
      'ultimo_intento', ultimo_intento, 'ultimo_ok', ultimo_ok, 'ok', ok, 'ms', ms, 'detalle', detalle
    )) FROM panel_latido), '{}'::jsonb),
  'kommo', (SELECT jsonb_build_object(
      'registros', registros, 'con_lead', con_lead,
      'recordatorios_atrasados', recordatorios_atrasados, 'recordatorios_enviados_7d', recordatorios_enviados_7d
    ) FROM kommo),
  'base', jsonb_build_object(
    'conexiones', (SELECT count(*) FROM pg_stat_activity),
    'max_conexiones', current_setting('max_connections')::int,
    'bytes', pg_database_size(current_database())
  )
);
$$;

REVOKE ALL ON FUNCTION public.panel_control_metricas() FROM PUBLIC, anon, authenticated;
