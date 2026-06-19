-- =============================================================================
-- AgendaW — RLS: tablas solo servidor (API key admin en rutas /admin y APIs)
-- El flujo papás en agendaw.vercel.app sigue en Supabase hasta el enlace final.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admission_appointments',
    'blocked_dates',
    'admission_schedules',
    'admission_permission_requests',
    'expediente_inicial',
    'tour_recorridos',
    'wsp'
  ]
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE IF EXISTS public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS agendaw_deny_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY agendaw_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
