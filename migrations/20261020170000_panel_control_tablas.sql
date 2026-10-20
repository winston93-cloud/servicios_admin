-- Panel de control: estadísticas de Postgres por tabla (registros vivos, muertos, lecturas completas y por índice)
-- para los medidores de los 10 sistemas. Solo catálogo de estadísticas: no lee datos de las tablas.
CREATE OR REPLACE FUNCTION public.panel_control_metricas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '3s'
 SET lock_timeout TO '500ms'
AS $function$
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
  'tablas', coalesce((SELECT jsonb_object_agg(relname, jsonb_build_array(
      n_live_tup, n_dead_tup, seq_scan, coalesce(idx_scan, 0)
    )) FROM pg_stat_user_tables
    WHERE schemaname = 'public' AND n_live_tup + n_dead_tup >= 1000), '{}'::jsonb),
  'base', jsonb_build_object(
    'conexiones', (SELECT count(*) FROM pg_stat_activity),
    'max_conexiones', current_setting('max_connections')::int,
    'bytes', pg_database_size(current_database())
  )
);
$function$;
