-- Trámites pagados en Administrativo (pagos internos) que elabora Control Escolar.
-- CONSTANCIA, CONSTANCIA Y COTEJO, CREDENCIAL, REIMPRESIÓN DE BOLETA, CONSTANCIA URGENTE.

CREATE TABLE IF NOT EXISTS public.ce_tramite_administrativo (
  id bigserial PRIMARY KEY,
  pago_id integer NOT NULL,
  alumno_id integer NOT NULL,
  alumno_ref text NOT NULL,
  concepto_id smallint NOT NULL,
  concepto_nombre text NOT NULL,
  pago_folio integer,
  pago_ciclo_escolar smallint,
  alumno_nivel smallint,
  estado text NOT NULL DEFAULT 'pendiente',
  creado_at timestamptz NOT NULL DEFAULT now(),
  correo_aviso_at timestamptz,
  recordatorio_at timestamptz,
  liberado_at timestamptz,
  liberado_por text,
  CONSTRAINT ce_tramite_administrativo_estado_chk
    CHECK (estado IN ('pendiente', 'liberado', 'cancelado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ce_tramite_administrativo_pago_id_uidx
  ON public.ce_tramite_administrativo (pago_id);

CREATE INDEX IF NOT EXISTS ce_tramite_administrativo_estado_nivel_idx
  ON public.ce_tramite_administrativo (estado, alumno_nivel, creado_at DESC);

COMMENT ON TABLE public.ce_tramite_administrativo IS
  'Cola de documentos pagados en caja interna y pendientes de elaborar en Control Escolar.';

ALTER TABLE public.ce_tramite_administrativo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ce_tramite_administrativo FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.ce_tramite_administrativo;
CREATE POLICY servicios_insforge_deny_anon ON public.ce_tramite_administrativo
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.ce_tramite_administrativo FROM anon, authenticated;
