-- =============================================================================
-- RLS — Winston Servicios (InsForge)
-- Ejecutar en: InsForge Dashboard → SQL, o:
--   npx @insforge/cli db query --file sql/insforge_rls_servicios.sql
--
-- Contexto:
-- - El navegador usa proxy Next.js /api/database/records (INSFORGE_API_KEY en servidor).
-- - Las rutas API usan INSFORGE_API_KEY (admin, bypass RLS).
-- - Rol anon: sin acceso a tablas operativas (política deny_anon).
-- =============================================================================

-- Roles PostgREST / SDK
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Secuencias (INSERT con SERIAL/IDENTITY desde anon)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- A) Solo servidor — RLS ON, sin políticas para anon (solo INSFORGE_API_KEY)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'banorte_pago_pendiente',
    'banorte_payw_intento',
    'openpay_webhook_verificacion',
    'openpay_webhook_log',
    'pago_boucher_precio',
    'boleta_materia',
    'boleta_maestro',
    'boleta_maestro_grupo',
    'registro_salida_pie',
    'pago_prorroga',
    'alumno_dato_medico'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    pol := 'servicios_insforge_deny_anon';
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      pol,
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- B) Navegador (panel / portal alumno / POS) — RLS ON + política permisiva anon
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'ciclos_escolares',
    'concepto_beca',
    'concepto_boucher',
    'concepto_interno',
    'alumno',
    'alumno_detalles',
    'alumno_familiar',
    'alumno_contacto',
    'alumno_beca',
    'pago_detalle',
    'pago_interno',
    'pago_interno_precio',
    'personal',
    'usuario'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    pol := 'servicios_insforge_deny_anon';
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_anon_%I ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      pol,
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Verificación
-- -----------------------------------------------------------------------------

SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_activo,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS num_politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'ciclos_escolares',
    'concepto_beca',
    'concepto_boucher',
    'concepto_interno',
    'alumno',
    'alumno_detalles',
    'alumno_familiar',
    'alumno_contacto',
    'alumno_beca',
    'pago_boucher_precio',
    'pago_interno_precio',
    'boleta_materia',
    'boleta_maestro',
    'boleta_maestro_grupo',
    'pago_detalle',
    'pago_interno',
    'pago_prorroga',
    'personal',
    'usuario',
    'banorte_pago_pendiente',
    'banorte_payw_intento',
    'openpay_webhook_verificacion',
    'openpay_webhook_log',
    'registro_salida_pie',
    'alumno_dato_medico'
  )
ORDER BY c.relname;
