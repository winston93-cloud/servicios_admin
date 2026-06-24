-- RLS servidor-only para tablas CFDI Fase 2 (mismo patrón que Winston Servicios)

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'datos_facturacion',
    'cfdi_timbrado',
    'cfdi_cancelacion',
    'cfdi_nota_credito'
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

SELECT c.relname AS tabla, c.relrowsecurity AS rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('datos_facturacion', 'cfdi_timbrado', 'cfdi_cancelacion', 'cfdi_nota_credito')
ORDER BY c.relname;
