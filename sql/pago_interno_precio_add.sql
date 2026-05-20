-- =============================================================================
-- pago_interno_precio (MySQL winston_general → Supabase)
-- Precio por concepto, nivel, grado y ciclo escolar.
-- alumno_nivel: 0 = genérico; 1 Maternal, 2 Kinder, 3 Primaria, 4 Secundaria.
-- alumno_grado: 0 = aplica a todo el nivel; >0 grado dentro del nivel.
--
-- Importar CSV:
--   node scripts/fix-pago-interno-precio-csv.mjs ruta/pago_interno_precio.csv
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pago_interno_precio (
  precio_interno_id INTEGER PRIMARY KEY,
  alumno_nivel SMALLINT NOT NULL,
  alumno_grado SMALLINT NOT NULL,
  concepto_id SMALLINT NOT NULL,
  precio_interno NUMERIC(6, 2) NOT NULL,
  precio_ciclo_escolar INTEGER NOT NULL
);

COMMENT ON TABLE public.pago_interno_precio IS 'Precios de conceptos internos por nivel, grado y ciclo.';

CREATE INDEX IF NOT EXISTS pago_interno_precio_concepto ON public.pago_interno_precio (concepto_id);
CREATE INDEX IF NOT EXISTS pago_interno_precio_ciclo ON public.pago_interno_precio (precio_ciclo_escolar);
CREATE INDEX IF NOT EXISTS pago_interno_precio_lookup ON public.pago_interno_precio (
  concepto_id,
  precio_ciclo_escolar,
  alumno_nivel,
  alumno_grado
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_interno_precio_concepto_id_fkey'
  ) THEN
    ALTER TABLE public.pago_interno_precio
      ADD CONSTRAINT pago_interno_precio_concepto_id_fkey
      FOREIGN KEY (concepto_id) REFERENCES public.concepto_interno (concepto_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- SELECT setval(
--   pg_get_serial_sequence('public.pago_interno_precio', 'precio_interno_id'),
--   COALESCE((SELECT MAX(precio_interno_id) FROM public.pago_interno_precio), 1)
-- );
