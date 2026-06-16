-- =============================================================================
-- InsForge Security Advisor — Fase 2: cerrar 16 políticas permisivas
-- Ejecutar después de desplegar proxy /api/database + /api/auth/login
--
--   insforge db query "$(cat migrations/20260615160000_insforge_rls_deny_client_tables.sql)"
-- =============================================================================

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'alumno',
    'alumno_beca',
    'alumno_contacto',
    'alumno_detalles',
    'alumno_familiar',
    'ciclos_escolares',
    'concepto_beca',
    'concepto_boucher',
    'concepto_desayunos',
    'concepto_interno',
    'pago_desayunos',
    'pago_detalle',
    'pago_interno',
    'pago_interno_precio',
    'personal',
    'usuario'
  ];
  pol_anon text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    pol_anon := 'servicios_insforge_anon_' || t;
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_anon, t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY servicios_insforge_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls,
  c.relforcerowsecurity AS forzado,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'alumno', 'alumno_beca', 'alumno_contacto', 'alumno_detalles', 'alumno_familiar',
    'ciclos_escolares', 'concepto_beca', 'concepto_boucher', 'concepto_desayunos',
    'concepto_interno', 'pago_desayunos', 'pago_detalle', 'pago_interno',
    'pago_interno_precio', 'personal', 'usuario'
  )
ORDER BY c.relname;
