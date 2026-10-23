-- Pagos internos: bitácora de cada movimiento, contexto del cobro e intentos fallidos (Mario, 23 oct 2026).
-- Auditoría con recibos en mano: el consecutivo Winston se rompió con cobros a «Externo» y sin saber
-- quién cobró ni con qué serie. Esto solo registra: no cambia cómo se asignan los folios.

-- Contexto que la pantalla de caja guarda en el pago (nullable: pagos anteriores no lo traen).
ALTER TABLE public.pago_interno
  ADD COLUMN IF NOT EXISTS pago_usuario varchar(60),
  ADD COLUMN IF NOT EXISTS pago_plantel_serie varchar(10),
  ADD COLUMN IF NOT EXISTS pago_tipo_serie varchar(12),
  ADD COLUMN IF NOT EXISTS pago_regla_serie varchar(20),
  ADD COLUMN IF NOT EXISTS pago_folio_mostrado integer,
  ADD COLUMN IF NOT EXISTS pago_origen varchar(20),
  ADD COLUMN IF NOT EXISTS pago_modifico varchar(60),
  ADD COLUMN IF NOT EXISTS pago_modifico_en timestamptz;

-- Serie a la que pertenece un folio según las reglas del sistema (pagoInternoPlantel.ts):
-- cuota = conceptos 1 y 2; Externo (11404) cuenta en Winston; maternal/kinder → Educativo.
CREATE OR REPLACE FUNCTION public.pago_interno_serie(p_folio integer, p_concepto integer, p_nivel integer, p_ref integer)
RETURNS varchar
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_folio IS NULL THEN NULL
    WHEN p_folio >= 900000 THEN 'fuera_talon'
    ELSE (CASE WHEN p_ref = 11404 OR coalesce(p_nivel, 0) NOT IN (1, 2) THEN 'winston' ELSE 'educativo' END)
      || (CASE WHEN p_concepto IN (1, 2) THEN '_cuota' ELSE '_general' END)
  END
$$;

CREATE TABLE IF NOT EXISTS public.pago_interno_bitacora (
  id bigserial PRIMARY KEY,
  en timestamptz NOT NULL DEFAULT now(),
  operacion varchar(14) NOT NULL,
  pago_id integer NOT NULL,
  folio_antes integer,
  folio_despues integer,
  cancelado_antes smallint,
  cancelado_despues smallint,
  alumno_id integer,
  alumno_ref integer,
  alumno_nivel smallint,
  concepto_id smallint,
  importe_antes numeric(10, 2),
  importe_despues numeric(10, 2),
  pago_fecha date,
  ciclo smallint,
  usuario varchar(60),
  origen varchar(20),
  plantel_serie varchar(10),
  tipo_serie varchar(12),
  regla_serie varchar(20),
  folio_mostrado integer,
  serie_sistema varchar(20),
  db_rol text NOT NULL DEFAULT current_user,
  cambios jsonb
);
CREATE INDEX IF NOT EXISTS pago_interno_bitacora_pago ON public.pago_interno_bitacora (pago_id);
CREATE INDEX IF NOT EXISTS pago_interno_bitacora_en ON public.pago_interno_bitacora (en DESC);

ALTER TABLE public.pago_interno_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pago_interno_bitacora FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.pago_interno_bitacora;
CREATE POLICY servicios_insforge_deny_anon ON public.pago_interno_bitacora
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.pago_interno_bitacora FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.pago_interno_bitacora_registrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.pago_interno%ROWTYPE;
  v_op varchar(14);
  v_cambios jsonb := '{}'::jsonb;
  v_usuario varchar(60);
  v_origen varchar(20);
  v_nivel smallint;
  v_ref integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_op := 'alta';
    v_usuario := NEW.pago_usuario;
    v_origen := NEW.pago_origen;
  ELSIF TG_OP = 'DELETE' THEN
    v_op := 'baja';
  ELSE
    IF NEW.alumno_id IS DISTINCT FROM OLD.alumno_id THEN v_cambios := v_cambios || jsonb_build_object('alumno_id', jsonb_build_array(OLD.alumno_id, NEW.alumno_id)); END IF;
    IF NEW.concepto_id IS DISTINCT FROM OLD.concepto_id THEN v_cambios := v_cambios || jsonb_build_object('concepto_id', jsonb_build_array(OLD.concepto_id, NEW.concepto_id)); END IF;
    IF NEW.concepto_otro IS DISTINCT FROM OLD.concepto_otro THEN v_cambios := v_cambios || jsonb_build_object('concepto_otro', jsonb_build_array(OLD.concepto_otro, NEW.concepto_otro)); END IF;
    IF NEW.pago_importe IS DISTINCT FROM OLD.pago_importe THEN v_cambios := v_cambios || jsonb_build_object('importe', jsonb_build_array(OLD.pago_importe, NEW.pago_importe)); END IF;
    IF NEW.pago_fecha IS DISTINCT FROM OLD.pago_fecha THEN v_cambios := v_cambios || jsonb_build_object('fecha', jsonb_build_array(OLD.pago_fecha, NEW.pago_fecha)); END IF;
    IF NEW.pago_ciclo_escolar IS DISTINCT FROM OLD.pago_ciclo_escolar THEN v_cambios := v_cambios || jsonb_build_object('ciclo', jsonb_build_array(OLD.pago_ciclo_escolar, NEW.pago_ciclo_escolar)); END IF;
    IF NEW.pago_folio IS DISTINCT FROM OLD.pago_folio THEN v_cambios := v_cambios || jsonb_build_object('folio', jsonb_build_array(OLD.pago_folio, NEW.pago_folio)); END IF;
    IF NEW.pago_cancelado IS DISTINCT FROM OLD.pago_cancelado THEN v_cambios := v_cambios || jsonb_build_object('cancelado', jsonb_build_array(OLD.pago_cancelado, NEW.pago_cancelado)); END IF;
    IF v_cambios = '{}'::jsonb THEN RETURN NULL; END IF;

    v_op := CASE
      WHEN v_cambios ? 'cancelado' AND NEW.pago_cancelado = 1 THEN 'cancelacion'
      WHEN v_cambios ? 'cancelado' THEN 'reactivacion'
      WHEN v_cambios ? 'folio' THEN 'folio'
      ELSE 'edicion'
    END;
    -- Solo se atribuye a quien modificó en esta misma escritura; un cambio directo en la base queda sin usuario.
    IF NEW.pago_modifico_en IS DISTINCT FROM OLD.pago_modifico_en THEN
      v_usuario := NEW.pago_modifico;
      v_origen := NEW.pago_origen;
    END IF;
  END IF;

  SELECT a.alumno_nivel, a.alumno_ref INTO v_nivel, v_ref FROM public.alumno a WHERE a.alumno_id = r.alumno_id;

  INSERT INTO public.pago_interno_bitacora (
    operacion, pago_id, folio_antes, folio_despues, cancelado_antes, cancelado_despues,
    alumno_id, alumno_ref, alumno_nivel, concepto_id, importe_antes, importe_despues,
    pago_fecha, ciclo, usuario, origen, plantel_serie, tipo_serie, regla_serie, folio_mostrado,
    serie_sistema, cambios
  ) VALUES (
    v_op, r.pago_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.pago_folio END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.pago_folio END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.pago_cancelado END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.pago_cancelado END,
    r.alumno_id, v_ref, v_nivel, r.concepto_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.pago_importe END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.pago_importe END,
    r.pago_fecha, r.pago_ciclo_escolar, v_usuario, v_origen,
    r.pago_plantel_serie, r.pago_tipo_serie, r.pago_regla_serie, r.pago_folio_mostrado,
    public.pago_interno_serie(r.pago_folio, r.concepto_id, v_nivel, v_ref),
    NULLIF(v_cambios, '{}'::jsonb)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_interno_bitacora ON public.pago_interno;
CREATE TRIGGER trg_pago_interno_bitacora
  AFTER INSERT OR UPDATE OR DELETE ON public.pago_interno
  FOR EACH ROW EXECUTE FUNCTION public.pago_interno_bitacora_registrar();

-- Cobros que no se completaron (error, red, recibo que no sale): lo que vio la cajera.
CREATE TABLE IF NOT EXISTS public.pago_interno_intento (
  id bigserial PRIMARY KEY,
  en timestamptz NOT NULL DEFAULT now(),
  usuario varchar(60),
  etapa varchar(20) NOT NULL,
  alumno_id integer,
  concepto_id smallint,
  importe numeric(10, 2),
  plantel_serie varchar(10),
  tipo_serie varchar(12),
  regla_serie varchar(20),
  folio_mostrado integer,
  pago_id integer,
  folio integer,
  mensaje text
);
CREATE INDEX IF NOT EXISTS pago_interno_intento_en ON public.pago_interno_intento (en DESC);

ALTER TABLE public.pago_interno_intento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pago_interno_intento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.pago_interno_intento;
CREATE POLICY servicios_insforge_deny_anon ON public.pago_interno_intento
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.pago_interno_intento FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_intento_pago_interno(p jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.pago_interno_intento (
    usuario, etapa, alumno_id, concepto_id, importe, plantel_serie, tipo_serie, regla_serie,
    folio_mostrado, pago_id, folio, mensaje
  ) VALUES (
    left(p->>'usuario', 60),
    coalesce(left(p->>'etapa', 20), 'cobro'),
    (p->>'alumno_id')::integer,
    (p->>'concepto_id')::smallint,
    (p->>'importe')::numeric(10, 2),
    left(p->>'plantel_serie', 10),
    left(p->>'tipo_serie', 12),
    left(p->>'regla_serie', 20),
    (p->>'folio_mostrado')::integer,
    (p->>'pago_id')::integer,
    (p->>'folio')::integer,
    left(p->>'mensaje', 1000)
  );
$$;
REVOKE ALL ON FUNCTION public.registrar_intento_pago_interno(jsonb) FROM PUBLIC, anon, authenticated;

-- Revisión del consecutivo de las 4 series en los últimos p_dias: huecos, repetidos y cruces.
-- Cruce = número dentro del tramo de una serie ocupado por un pago que el sistema cuenta en otra
-- (p. ej. Externo o alumno de kinder con folio de la otra serie).
CREATE OR REPLACE FUNCTION public.pago_interno_consecutivo(p_dias integer DEFAULT 45)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '3s'
AS $$
WITH rangos(serie, minimo, techo) AS (
  VALUES
    ('winston_general', 2671, 4000),
    ('educativo_general', 2849, 3480),
    ('winston_cuota', 2140, 2849),
    ('educativo_cuota', 1037, 2140)
),
pagos AS (
  SELECT p.pago_id, p.pago_folio AS folio, p.pago_cancelado, p.concepto_id, p.concepto_otro,
    public.pago_interno_serie(p.pago_folio, p.concepto_id, a.alumno_nivel, a.alumno_ref) AS serie
  FROM public.pago_interno p
  LEFT JOIN public.alumno a ON a.alumno_id = p.alumno_id
  WHERE p.pago_fecha >= current_date - p_dias
),
en_serie AS (
  SELECT p.*
  FROM rangos r
  JOIN pagos p ON p.serie = r.serie AND p.folio >= r.minimo AND p.folio < r.techo
),
tramo AS (
  SELECT serie, min(folio) AS desde, max(folio) AS hasta, count(*) AS pagos
  FROM en_serie GROUP BY serie
),
huecos AS (
  SELECT t.serie, n AS folio
  FROM tramo t
  CROSS JOIN LATERAL generate_series(t.desde, t.hasta) n
  WHERE NOT EXISTS (SELECT 1 FROM en_serie e WHERE e.serie = t.serie AND e.folio = n)
),
cruces AS (
  SELECT DISTINCT h.serie, h.folio
  FROM huecos h
  JOIN pagos p ON p.folio = h.folio AND p.serie <> h.serie
    AND (p.concepto_id IN (1, 2)) = (h.serie LIKE '%_cuota')
),
repetidos AS (
  SELECT serie, folio
  FROM en_serie
  WHERE serie LIKE '%_general' OR coalesce(concepto_otro, '') NOT LIKE 'Cuota compartida%'
  GROUP BY serie, folio
  HAVING count(*) > 1
)
SELECT jsonb_build_object(
  'dias', p_dias,
  'series', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'serie', t.serie, 'desde', t.desde, 'hasta', t.hasta, 'pagos', t.pagos,
      'huecos', coalesce((SELECT jsonb_agg(h.folio ORDER BY h.folio) FROM huecos h WHERE h.serie = t.serie
        AND NOT EXISTS (SELECT 1 FROM cruces c WHERE c.serie = h.serie AND c.folio = h.folio)), '[]'::jsonb),
      'cruces', coalesce((SELECT jsonb_agg(c.folio ORDER BY c.folio) FROM cruces c WHERE c.serie = t.serie), '[]'::jsonb),
      'repetidos', coalesce((SELECT jsonb_agg(x.folio ORDER BY x.folio) FROM repetidos x WHERE x.serie = t.serie), '[]'::jsonb)
    ) ORDER BY t.serie)
    FROM tramo t
  ), '[]'::jsonb),
  'apartados', (SELECT count(*) FROM public.pago_interno WHERE pago_folio >= 900000 AND pago_cancelado = 0
    AND pago_fecha >= current_date - 180),
  'intentos_24h', (SELECT count(*) FROM public.pago_interno_intento WHERE en > now() - interval '24 hours'),
  'intentos_7d', (SELECT count(*) FROM public.pago_interno_intento WHERE en > now() - interval '7 days'),
  'altas_7d', (SELECT count(*) FROM public.pago_interno_bitacora WHERE operacion = 'alta' AND en > now() - interval '7 days'),
  'altas_sin_usuario_7d', (SELECT count(*) FROM public.pago_interno_bitacora WHERE operacion = 'alta' AND usuario IS NULL
    AND en > now() - interval '7 days')
)
$$;
REVOKE ALL ON FUNCTION public.pago_interno_consecutivo(integer) FROM PUBLIC, anon, authenticated;
