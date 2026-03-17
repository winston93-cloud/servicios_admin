-- =====================================================
-- FUNCIONES CON PARÁMETROS - REQUIERE AJUSTE MANUAL
-- =====================================================
-- Estas funciones requieren especificar los tipos de parámetros exactos.
-- Para ejecutar este script, primero necesitas obtener las firmas exactas.

-- PASO 1: Ejecuta esta query para ver las firmas de las funciones:
/*
SELECT 
  p.proname as nombre_funcion,
  pg_get_function_identity_arguments(p.oid) as parametros
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
*/

-- PASO 2: Una vez que tengas las firmas, descomenta y ajusta estos comandos:

-- Ejemplo para generar_referencia_alumno que sabemos que recibe INTEGER:
ALTER FUNCTION public.generar_referencia_alumno(INTEGER) 
SET search_path = public, pg_temp;

-- Ejemplo para get_month_limits que sabemos que recibe dos INTEGER:
ALTER FUNCTION public.get_month_limits(INTEGER, INTEGER) 
SET search_path = public, pg_temp;

-- Para las demás, usa el formato:
-- ALTER FUNCTION public.nombre_funcion(tipo_param1, tipo_param2, ...) 
-- SET search_path = public, pg_temp;

-- generar_folio_cotizacion
-- ALTER FUNCTION public.generar_folio_cotizacion() 
-- SET search_path = public, pg_temp;

-- crear_pedido_atomico
-- ALTER FUNCTION public.crear_pedido_atomico(...) 
-- SET search_path = public, pg_temp;

-- procesar_devolucion_atomica
-- ALTER FUNCTION public.procesar_devolucion_atomica(...) 
-- SET search_path = public, pg_temp;

-- validar_total_pedido
-- ALTER FUNCTION public.validar_total_pedido(...) 
-- SET search_path = public, pg_temp;

-- login_usuario
-- ALTER FUNCTION public.login_usuario(...) 
-- SET search_path = public, pg_temp;
