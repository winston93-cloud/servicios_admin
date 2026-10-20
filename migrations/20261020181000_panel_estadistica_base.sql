-- Panel de control: línea base de lecturas por tabla. Al arreglar una tabla (p. ej. agregar un índice) se guarda
-- su contador del momento y el medidor califica solo lo que pasó después (los contadores de Postgres son acumulados
-- y la plataforma no permite reiniciarlos).
CREATE TABLE IF NOT EXISTS public.panel_estadistica_base (
  tabla text PRIMARY KEY,
  seq_scan bigint NOT NULL,
  idx_scan bigint NOT NULL,
  motivo text,
  desde timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.panel_estadistica_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.panel_estadistica_base;
CREATE POLICY servicios_insforge_deny_anon ON public.panel_estadistica_base FOR ALL TO anon USING (false) WITH CHECK (false);
REVOKE ALL ON public.panel_estadistica_base FROM anon, authenticated;

INSERT INTO public.panel_estadistica_base (tabla, seq_scan, idx_scan, motivo)
SELECT relname, seq_scan, coalesce(idx_scan, 0), 'Índice ciclo + materia (20 oct 2026)'
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname IN ('boleta_calificacion', 'boleta_inasistencia')
ON CONFLICT (tabla) DO UPDATE SET seq_scan = excluded.seq_scan, idx_scan = excluded.idx_scan, motivo = excluded.motivo, desde = now();

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
  'tablas', coalesce((SELECT jsonb_object_agg(s.relname, jsonb_build_array(
      s.n_live_tup, s.n_dead_tup,
      greatest(0, s.seq_scan - coalesce(b.seq_scan, 0)),
      greatest(0, coalesce(s.idx_scan, 0) - coalesce(b.idx_scan, 0))
    )) FROM pg_stat_user_tables s
    LEFT JOIN panel_estadistica_base b ON b.tabla = s.relname
    WHERE s.schemaname = 'public' AND s.n_live_tup + s.n_dead_tup >= 1000), '{}'::jsonb),
  'base', jsonb_build_object(
    'conexiones', (SELECT count(*) FROM pg_stat_activity),
    'max_conexiones', current_setting('max_connections')::int,
    'bytes', pg_database_size(current_database())
  )
);
$function$;
