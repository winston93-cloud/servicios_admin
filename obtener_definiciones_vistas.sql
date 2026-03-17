-- =====================================================
-- OBTENER DEFINICIONES DE VISTAS CON SECURITY DEFINER
-- =====================================================
-- Ejecuta esto para ver las definiciones actuales

SELECT 
  schemaname,
  viewname,
  pg_get_viewdef(schemaname || '.' || viewname, true) as definicion
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'v_expenses_by_category',
    'v_expenses_by_person_category',
    'v_expenses_by_person',
    'vista_contratos_indeterminado',
    'v_balance',
    'vista_contratos_determinado',
    'vista_contratos_hora',
    'expense_details'
  )
ORDER BY viewname;
