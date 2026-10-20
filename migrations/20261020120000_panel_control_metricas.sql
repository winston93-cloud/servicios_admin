-- Panel de control (/panel-control, solo sistemas): lecturas de base de datos de los procesos en una sola
-- llamada. `pago_detalle.pago_registro` se guarda en UTC sin zona; los días se cuentan en hora de Monterrey.
-- Solo la llave admin del servidor la ejecuta.

CREATE OR REPLACE FUNCTION public.panel_control_metricas()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
ahora AS (
  SELECT (now() AT TIME ZONE 'America/Monterrey') AS l
),
pagos AS (
  SELECT
    (p.pago_registro AT TIME ZONE 'UTC') AT TIME ZONE 'America/Monterrey' AS l,
    p.pago_forma,
    p.facturo
  FROM pago_detalle p
  WHERE p.pago_registro >= (now() AT TIME ZONE 'UTC') - interval '30 days'
    AND coalesce(p.pago_cancelado, 0) NOT IN (1, 2)
    AND coalesce(p.pago_importe, 0) > 0
),
pagos_m AS (
  SELECT
    count(*) FILTER (WHERE pg.l::date = a.l::date) AS hoy,
    count(*) FILTER (
      WHERE pg.l::date IN (a.l::date - 7, a.l::date - 14, a.l::date - 21, a.l::date - 28)
        AND pg.l::time <= a.l::time
    ) / 4.0 AS esperado,
    max(pg.l) AS ultimo,
    count(*) FILTER (WHERE pg.l >= a.l - interval '7 days' AND pg.l < a.l - interval '30 minutes') AS fact_total,
    count(*) FILTER (
      WHERE pg.l >= a.l - interval '7 days' AND pg.l < a.l - interval '30 minutes' AND upper(coalesce(pg.facturo, '')) = 'SI'
    ) AS fact_ok,
    count(*) FILTER (WHERE pg.l::date = a.l::date AND pg.pago_forma = 'Comercio Electronico') AS hoy_banorte,
    count(*) FILTER (WHERE pg.l::date = a.l::date AND pg.pago_forma = 'Openpay') AS hoy_openpay,
    count(*) FILTER (WHERE pg.l::date = a.l::date AND pg.pago_forma = 'Efectivo') AS hoy_efectivo
  FROM pagos pg, ahora a
),
openpay AS (
  SELECT
    count(*) FILTER (WHERE ok) AS ok,
    count(*) FILTER (WHERE NOT ok) AS fallas
  FROM openpay_webhook_log
  WHERE recibido_en > now() - interval '24 hours'
),
reportes AS (
  SELECT
    count(*) FILTER (WHERE r.reporte_status = 1) AS validos,
    count(*) FILTER (WHERE r.reporte_status = 2) AS por_validar,
    count(*) FILTER (
      WHERE r.reporte_status = 1
        AND (
          (r.reporte_tipo <> 9 AND r.reporte_enviado = 1)
          OR (r.reporte_tipo = 9 AND EXISTS (
            SELECT 1 FROM reporte_suspension s WHERE s.reporte_id = r.reporte_id AND s.suspension_enviada = 1
          ))
        )
    ) AS enviados,
    count(*) FILTER (WHERE r.reporte_registro >= date_trunc('day', now() AT TIME ZONE 'America/Monterrey') AT TIME ZONE 'America/Monterrey') AS hoy
  FROM reporte_escolar r
  WHERE r.reporte_registro > now() - interval '7 days'
),
talleres_dia AS (
  SELECT max(t.fecha) AS fecha
  FROM taller_asistencia t, ahora a
  WHERE t.fecha <= a.l::date
),
talleres AS (
  SELECT
    d.fecha,
    count(t.*) AS clases,
    count(t.*) FILTER (WHERE t.lista_pasada) AS con_lista,
    count(t.*) FILTER (WHERE t.maestro_falto) AS maestro_falto,
    coalesce(sum(t.total_alumnos) FILTER (WHERE t.lista_pasada AND NOT coalesce(t.maestro_falto, false)), 0) AS alumnos,
    coalesce(sum(cardinality(t.faltas)) FILTER (WHERE t.lista_pasada AND NOT coalesce(t.maestro_falto, false)), 0) AS faltas
  FROM talleres_dia d
  LEFT JOIN taller_asistencia t ON t.fecha = d.fecha
  GROUP BY d.fecha
),
oh_edicion AS (
  SELECT edicion_open_house AS ed
  FROM inscripciones
  WHERE edicion_open_house IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1
),
open_house AS (
  SELECT
    e.ed AS edicion,
    count(i.*) AS registros,
    count(i.*) FILTER (WHERE EXISTS (
      SELECT 1 FROM kommo_lead_tracking k
      WHERE (coalesce(i.email, '') <> '' AND lower(k.email) = lower(i.email))
         OR (
           length(regexp_replace(coalesce(i.telefono, ''), '\D', '', 'g')) >= 10
           AND right(regexp_replace(coalesce(k.telefono, ''), '\D', '', 'g'), 10)
             = right(regexp_replace(i.telefono, '\D', '', 'g'), 10)
         )
    )) AS con_kommo,
    count(i.*) FILTER (WHERE i.created_at > now() - interval '24 hours') AS ultimas_24h
  FROM oh_edicion e
  LEFT JOIN inscripciones i ON i.edicion_open_house = e.ed
  GROUP BY e.ed
),
base AS (
  SELECT
    (SELECT count(*) FROM pg_stat_activity) AS conexiones,
    current_setting('max_connections')::int AS max_conexiones,
    pg_database_size(current_database()) AS bytes
)
SELECT jsonb_build_object(
  'ahora', (SELECT to_char(l, 'YYYY-MM-DD"T"HH24:MI:SS') FROM ahora),
  'pagos', (SELECT jsonb_build_object(
      'hoy', hoy, 'esperado', round(esperado, 1),
      'ultimo', to_char(ultimo, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'banorte', hoy_banorte, 'openpay', hoy_openpay, 'efectivo', hoy_efectivo,
      'openpay_ok_24h', (SELECT ok FROM openpay), 'openpay_fallas_24h', (SELECT fallas FROM openpay)
    ) FROM pagos_m),
  'facturacion', (SELECT jsonb_build_object('total', fact_total, 'facturados', fact_ok) FROM pagos_m),
  'reportes', (SELECT jsonb_build_object(
      'validos', validos, 'enviados', enviados, 'por_validar', por_validar, 'hoy', hoy
    ) FROM reportes),
  'talleres', (SELECT jsonb_build_object(
      'fecha', fecha, 'clases', clases, 'con_lista', con_lista, 'maestro_falto', maestro_falto,
      'alumnos', alumnos, 'faltas', faltas
    ) FROM talleres),
  'open_house', (SELECT jsonb_build_object(
      'edicion', edicion, 'registros', registros, 'con_kommo', con_kommo, 'ultimas_24h', ultimas_24h
    ) FROM open_house),
  'base', (SELECT jsonb_build_object(
      'conexiones', conexiones, 'max_conexiones', max_conexiones, 'bytes', bytes
    ) FROM base)
);
$$;

REVOKE ALL ON FUNCTION public.panel_control_metricas() FROM PUBLIC, anon, authenticated;
