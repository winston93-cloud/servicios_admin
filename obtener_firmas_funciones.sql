-- =====================================================
-- OBTENER FIRMAS DE FUNCIONES PENDIENTES
-- Ejecuta esta query para ver las firmas exactas
-- =====================================================

SELECT 
  p.proname as nombre_funcion,
  pg_get_function_identity_arguments(p.oid) as parametros,
  'ALTER FUNCTION public.' || p.proname || '(' || 
    pg_get_function_identity_arguments(p.oid) || 
    ') SET search_path = public, pg_temp;' as comando_sql
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'generar_folio_cotizacion',
    'generar_referencia_alumno',
    'get_month_limits',
    'crear_pedido_atomico',
    'procesar_devolucion_atomica',
    'validar_total_pedido',
    'login_usuario'
  )
ORDER BY p.proname;
