-- =====================================================
-- SCRIPT SIMPLE PARA SOLUCIONAR ADVERTENCIAS
-- Solo incluye comandos seguros que sabemos funcionarán
-- =====================================================

-- 1. FIJAR search_path EN FUNCIONES SIN PARÁMETROS
ALTER FUNCTION public.update_costos_updated_at() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.update_executors_updated_at() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.update_custom_periods_updated_at() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.update_devoluciones_updated_at() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_folio_transferencia() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.obtener_tallas_ordenadas() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.audit_costos_changes() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at_column() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.refresh_reportes() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.validar_integridad_sistema() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.update_ciclo_escolar_updated_at() 
SET search_path = public, pg_temp;

ALTER FUNCTION public.asegurar_un_ciclo_actual() 
SET search_path = public, pg_temp;

-- 2. RESTRINGIR ACCESO A VISTA MATERIALIZADA
REVOKE ALL ON public.mv_ventas_por_sucursal FROM anon;
REVOKE ALL ON public.mv_ventas_por_sucursal FROM authenticated;
