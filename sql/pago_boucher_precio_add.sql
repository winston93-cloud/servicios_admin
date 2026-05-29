-- =============================================================================
-- pago_boucher_precio (MySQL winston_general → Supabase)
-- Importar:
--   node scripts/import-pago-boucher-precio-supabase.mjs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pago_boucher_precio (
  precio_id INTEGER PRIMARY KEY,
  alumno_nivel SMALLINT NOT NULL,
  precio_inscripcion NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_material NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_seguro NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_cuota_padres NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_agosto NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_colegiatura NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_colegiatura2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_cambridge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  precio_dtitulacion NUMERIC(10, 2) NOT NULL DEFAULT 0,
  descuento_cambio_nivel SMALLINT NOT NULL DEFAULT 0,
  descuento_cambio_grado SMALLINT NOT NULL DEFAULT 0,
  precio_ciclo_escolar SMALLINT NOT NULL
);

CREATE INDEX IF NOT EXISTS pago_boucher_precio_ciclo_nivel
  ON public.pago_boucher_precio (precio_ciclo_escolar, alumno_nivel);

COMMENT ON TABLE public.pago_boucher_precio IS 'Precios por nivel y ciclo para bauchers (legacy pago_boucher_precio).';
