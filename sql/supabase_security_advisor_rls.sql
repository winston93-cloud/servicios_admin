-- =============================================================================
-- Supabase Security Advisor — RLS en tablas públicas (servicios_admin)
-- Ejecutar en: Supabase → SQL Editor → Run (proyecto winston93-cloud)
--
-- Qué hace:
-- 1) Habilita RLS en tablas sensibles (cierra acceso vía API anon/authenticated).
-- 2) La app Next.js con SUPABASE_SERVICE_ROLE_KEY sigue igual (bypass RLS).
-- 3) Tablas que el panel Servicios usa desde el navegador con anon key llevan
--    política permisiva temporal (mismo comportamiento que hoy; ver nota abajo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Solo servidor — RLS ON, sin políticas (anon/authenticated = sin acceso)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.banorte_pago_pendiente ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.banorte_payw_intento ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.openpay_webhook_verificacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.openpay_webhook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pago_prorroga ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boleta_maestro ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.boleta_maestro_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.registro_salida_pie ENABLE ROW LEVEL SECURITY;

-- Refuerzo: quitar permisos directos al rol anon (PostgREST)
REVOKE ALL ON public.banorte_pago_pendiente FROM anon, authenticated;
REVOKE ALL ON public.banorte_payw_intento FROM anon, authenticated;
REVOKE ALL ON public.openpay_webhook_verificacion FROM anon, authenticated;
REVOKE ALL ON public.openpay_webhook_log FROM anon, authenticated;
REVOKE ALL ON public.pago_prorroga FROM anon, authenticated;
REVOKE ALL ON public.boleta_maestro FROM anon, authenticated;
REVOKE ALL ON public.boleta_maestro_grupo FROM anon, authenticated;
REVOKE ALL ON public.registro_salida_pie FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) Módulo Becas (cliente usa NEXT_PUBLIC_SUPABASE_ANON_KEY en el navegador)
-- RLS ON + política permisiva = desaparece el error del asesor; misma UX que hoy.
-- Mejora futura: mover Becas a rutas API con service role y quitar estas políticas.
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.alumno_beca ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.concepto_beca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_admin_anon_alumno_beca ON public.alumno_beca;
CREATE POLICY servicios_admin_anon_alumno_beca
  ON public.alumno_beca
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS servicios_admin_anon_concepto_beca ON public.concepto_beca;
CREATE POLICY servicios_admin_anon_concepto_beca
  ON public.concepto_beca
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- C) Vista expense_details — quitar SECURITY DEFINER (PostgreSQL 15+)
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'expense_details'
  ) THEN
    EXECUTE 'ALTER VIEW public.expense_details SET (security_invoker = on)';
    RAISE NOTICE 'Vista expense_details: security_invoker activado.';
  ELSE
    RAISE NOTICE 'Vista expense_details no existe; omitido.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'expense_details (revisar manualmente en Dashboard): %', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- D) Fase 2 — 10 errores restantes (tras primer script)
-- -----------------------------------------------------------------------------

-- Solo servidor / otros módulos del proyecto Supabase (sin políticas anon)
ALTER TABLE IF EXISTS public.boleta_materia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.boleta_materia FROM anon, authenticated;
REVOKE ALL ON public.branches FROM anon, authenticated;
REVOKE ALL ON public.attendance_imports FROM anon, authenticated;
REVOKE ALL ON public.attendance_records FROM anon, authenticated;

-- Panel Servicios (navegador + anon): RLS + política permisiva = cierra error del asesor
ALTER TABLE IF EXISTS public.concepto_interno ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pago_interno ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pago_interno_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.concepto_boucher ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pago_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_admin_anon_concepto_interno ON public.concepto_interno;
CREATE POLICY servicios_admin_anon_concepto_interno
  ON public.concepto_interno FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicios_admin_anon_pago_interno ON public.pago_interno;
CREATE POLICY servicios_admin_anon_pago_interno
  ON public.pago_interno FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicios_admin_anon_pago_interno_precio ON public.pago_interno_precio;
CREATE POLICY servicios_admin_anon_pago_interno_precio
  ON public.pago_interno_precio FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicios_admin_anon_concepto_boucher ON public.concepto_boucher;
CREATE POLICY servicios_admin_anon_concepto_boucher
  ON public.concepto_boucher FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS servicios_admin_anon_pago_detalle ON public.pago_detalle;
CREATE POLICY servicios_admin_anon_pago_detalle
  ON public.pago_detalle FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- E) Último error habitual: pago_boucher_precio (solo API bauchers / portal)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.pago_boucher_precio ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pago_boucher_precio FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Verificación rápida (debe mostrar rowsecurity = true)
-- -----------------------------------------------------------------------------

SELECT
  c.relname AS tabla,
  c.relrowsecurity AS rls_activo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'banorte_pago_pendiente',
    'openpay_webhook_verificacion',
    'openpay_webhook_log',
    'pago_prorroga',
    'alumno_beca',
    'concepto_beca',
    'boleta_maestro',
    'concepto_interno',
    'boleta_materia',
    'branches',
    'pago_interno_precio',
    'attendance_imports',
    'attendance_records',
    'pago_interno',
    'concepto_boucher',
    'pago_detalle',
    'pago_boucher_precio'
  )
ORDER BY c.relname;
