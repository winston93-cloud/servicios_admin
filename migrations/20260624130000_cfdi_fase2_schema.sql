-- Fase 2 CFDI: datos fiscales de papás + auditoría de timbrado (Winston Servicios)

-- === Datos fiscales (migración desde MySQL winston_general.datos_facturacion) ===
CREATE TABLE IF NOT EXISTS public.datos_facturacion (
  id SERIAL PRIMARY KEY,
  moneda CHAR(5) NOT NULL DEFAULT 'MXN',
  rfc VARCHAR(15) NOT NULL,
  razsocial VARCHAR(75) NOT NULL,
  regfiscal VARCHAR(5) NOT NULL,
  usocfdi VARCHAR(5) NOT NULL,
  codpostal VARCHAR(5) NOT NULL,
  calle VARCHAR(35) NOT NULL,
  nexterior VARCHAR(8) NOT NULL DEFAULT '',
  ninterior VARCHAR(10) NOT NULL DEFAULT '',
  ncolonia VARCHAR(50) NOT NULL,
  nmunicipio VARCHAR(35) NOT NULL,
  nentidad VARCHAR(45) NOT NULL,
  email VARCHAR(45) NOT NULL,
  lada VARCHAR(15) NOT NULL DEFAULT '',
  numero VARCHAR(15) NOT NULL DEFAULT '',
  alumno_ref INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT datos_facturacion_alumno_ref_unique UNIQUE (alumno_ref)
);

CREATE INDEX IF NOT EXISTS idx_datos_facturacion_rfc ON public.datos_facturacion (rfc);
CREATE INDEX IF NOT EXISTS idx_datos_facturacion_updated ON public.datos_facturacion (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_datos_facturacion_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_datos_facturacion_updated_at ON public.datos_facturacion;
CREATE TRIGGER trg_datos_facturacion_updated_at
  BEFORE UPDATE ON public.datos_facturacion
  FOR EACH ROW EXECUTE FUNCTION public.set_datos_facturacion_updated_at();

-- === Auditoría timbrado (Fase 3+) ===
CREATE TABLE IF NOT EXISTS public.cfdi_timbrado (
  timbrado_id BIGSERIAL PRIMARY KEY,
  uuid VARCHAR(36),
  pago_referencia VARCHAR(20),
  alumno_ref INTEGER,
  emisor_rfc VARCHAR(13) NOT NULL,
  receptor_rfc VARCHAR(13),
  total NUMERIC(12, 2),
  serie VARCHAR(10),
  folio VARCHAR(20),
  tipo_operacion VARCHAR(40) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'timbrado',
  pac_codigo VARCHAR(20),
  pac_mensaje TEXT,
  xml_storage_path TEXT,
  pdf_storage_path TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por VARCHAR(100)
);

CREATE UNIQUE INDEX IF NOT EXISTS cfdi_timbrado_uuid_unique
  ON public.cfdi_timbrado (uuid) WHERE uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfdi_timbrado_pago_ref ON public.cfdi_timbrado (pago_referencia);
CREATE INDEX IF NOT EXISTS idx_cfdi_timbrado_alumno_ref ON public.cfdi_timbrado (alumno_ref);
CREATE INDEX IF NOT EXISTS idx_cfdi_timbrado_creado ON public.cfdi_timbrado (creado_en DESC);

-- === Auditoría cancelaciones ===
CREATE TABLE IF NOT EXISTS public.cfdi_cancelacion (
  cancelacion_id BIGSERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL,
  folio_sustitucion VARCHAR(36),
  motivo CHAR(2) NOT NULL,
  emisor_rfc VARCHAR(13) NOT NULL,
  receptor_rfc VARCHAR(13),
  total NUMERIC(12, 2),
  estado VARCHAR(20) NOT NULL DEFAULT 'solicitada',
  pac_respuesta JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_cfdi_cancelacion_uuid ON public.cfdi_cancelacion (uuid);
CREATE INDEX IF NOT EXISTS idx_cfdi_cancelacion_creado ON public.cfdi_cancelacion (creado_en DESC);

-- === Auditoría notas de crédito ===
CREATE TABLE IF NOT EXISTS public.cfdi_nota_credito (
  nota_id BIGSERIAL PRIMARY KEY,
  uuid VARCHAR(36),
  uuid_relacionado VARCHAR(36),
  pago_referencia VARCHAR(20),
  emisor_rfc VARCHAR(13) NOT NULL,
  total NUMERIC(12, 2),
  estado VARCHAR(20) NOT NULL DEFAULT 'timbrada',
  pac_respuesta JSONB,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_cfdi_nota_credito_uuid ON public.cfdi_nota_credito (uuid);
CREATE INDEX IF NOT EXISTS idx_cfdi_nota_credito_rel ON public.cfdi_nota_credito (uuid_relacionado);
