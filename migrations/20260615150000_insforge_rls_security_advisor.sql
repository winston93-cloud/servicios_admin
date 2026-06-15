-- =============================================================================
-- InsForge Security Advisor — Winston Servicios
-- Ejecutar en: InsForge Dashboard → SQL, o:
--   insforge db query "$(cat migrations/20260615150000_insforge_rls_security_advisor.sql)"
--
-- Resuelve (11 issues):
--   #1  alumno_dato_medico — RLS deshabilitado
--   #18-27 tablas solo-servidor con RLS sin políticas
--
-- Pendiente (16 issues #2-17):
--   Políticas permisivas servicios_insforge_anon_* en tablas del panel/POS/portal.
--   El navegador usa NEXT_PUBLIC_INSFORGE_ANON_KEY; auth.uid() no aplica (login legacy).
--   Cierre real: migrar lecturas/escrituras del cliente a rutas API con INSFORGE_API_KEY.
--   Ver: docs/INSFORGE_RLS.md
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- A) Ficha médica — solo rutas API (INSFORGE_API_KEY bypass RLS)
-- Issue #1
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.alumno_dato_medico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alumno_dato_medico FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_dato_medico;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_dato_medico
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.alumno_dato_medico FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) Solo servidor — RLS + política explícita de denegación al cliente
-- Issues #18-27
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'pago_boucher_precio',
    'openpay_webhook_log',
    'boleta_materia',
    'boleta_maestro',
    'boleta_maestro_grupo',
    'pago_prorroga',
    'banorte_pago_pendiente',
    'banorte_payw_intento',
    'openpay_webhook_verificacion',
    'registro_salida_pie'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY servicios_insforge_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
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
  c.relforcerowsecurity AS rls_forzado,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS num_politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'alumno_dato_medico',
    'pago_boucher_precio',
    'openpay_webhook_log',
    'boleta_materia',
    'boleta_maestro',
    'boleta_maestro_grupo',
    'pago_prorroga',
    'banorte_pago_pendiente',
    'banorte_payw_intento',
    'openpay_webhook_verificacion',
    'registro_salida_pie'
  )
ORDER BY c.relname;
