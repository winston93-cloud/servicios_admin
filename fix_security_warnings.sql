-- =====================================================
-- SCRIPT PARA SOLUCIONAR ADVERTENCIAS DE SEGURIDAD
-- Base de datos: desayunos
-- Fecha: 2026-02-11
-- Nivel: WARNINGS (menos crítico que errores)
-- =====================================================

-- =====================================================
-- 1. FIJAR search_path EN FUNCIONES
-- =====================================================
-- IMPORTANTE: Esto previene ataques de "search path hijacking"
-- donde un atacante podría crear objetos maliciosos en otros schemas

-- Función: generar_folio_cotizacion
ALTER FUNCTION public.generar_folio_cotizacion() 
SET search_path = public, pg_temp;

-- Función: update_costos_updated_at
ALTER FUNCTION public.update_costos_updated_at() 
SET search_path = public, pg_temp;

-- Función: generar_referencia_alumno
ALTER FUNCTION public.generar_referencia_alumno(INTEGER) 
SET search_path = public, pg_temp;

-- Función: update_executors_updated_at
ALTER FUNCTION public.update_executors_updated_at() 
SET search_path = public, pg_temp;

-- Función: update_custom_periods_updated_at
ALTER FUNCTION public.update_custom_periods_updated_at() 
SET search_path = public, pg_temp;

-- Función: update_devoluciones_updated_at
ALTER FUNCTION public.update_devoluciones_updated_at() 
SET search_path = public, pg_temp;

-- Función: generate_folio_transferencia
ALTER FUNCTION public.generate_folio_transferencia() 
SET search_path = public, pg_temp;

-- Función: get_month_limits
ALTER FUNCTION public.get_month_limits(INTEGER, INTEGER) 
SET search_path = public, pg_temp;

-- Función: obtener_tallas_ordenadas
ALTER FUNCTION public.obtener_tallas_ordenadas() 
SET search_path = public, pg_temp;

-- Función: crear_pedido_atomico
-- NOTA: Esta función puede tener parámetros, ajusta según sea necesario
-- ALTER FUNCTION public.crear_pedido_atomico(...parámetros...) 
-- SET search_path = public, pg_temp;

-- Función: procesar_devolucion_atomica
-- ALTER FUNCTION public.procesar_devolucion_atomica(...parámetros...) 
-- SET search_path = public, pg_temp;

-- Función: validar_total_pedido
-- ALTER FUNCTION public.validar_total_pedido(...parámetros...) 
-- SET search_path = public, pg_temp;

-- Función: audit_costos_changes
ALTER FUNCTION public.audit_costos_changes() 
SET search_path = public, pg_temp;

-- Función: login_usuario
-- ALTER FUNCTION public.login_usuario(...parámetros...) 
-- SET search_path = public, pg_temp;

-- Función: update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() 
SET search_path = public, pg_temp;

-- Función: refresh_reportes
ALTER FUNCTION public.refresh_reportes() 
SET search_path = public, pg_temp;

-- Función: validar_integridad_sistema
ALTER FUNCTION public.validar_integridad_sistema() 
SET search_path = public, pg_temp;

-- Función: update_ciclo_escolar_updated_at
ALTER FUNCTION public.update_ciclo_escolar_updated_at() 
SET search_path = public, pg_temp;

-- Función: asegurar_un_ciclo_actual
ALTER FUNCTION public.asegurar_un_ciclo_actual() 
SET search_path = public, pg_temp;

-- =====================================================
-- 2. MOVER EXTENSIÓN pg_trgm FUERA DE PUBLIC
-- =====================================================
-- ADVERTENCIA: Esto puede romper queries que dependen de pg_trgm
-- Asegúrate de probar en desarrollo antes de aplicar en producción

-- Crear schema para extensiones si no existe
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover la extensión (requiere permisos de superusuario)
-- ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- NOTA: Si esto falla, es porque necesitas permisos de superusuario.
-- En Supabase, esto generalmente se hace desde el dashboard o tickets de soporte.

-- =====================================================
-- 3. RESTRINGIR ACCESO A VISTA MATERIALIZADA
-- =====================================================
-- La vista materializada mv_ventas_por_sucursal no debería ser pública

-- Opción A: Revocar acceso público
REVOKE ALL ON public.mv_ventas_por_sucursal FROM anon;
REVOKE ALL ON public.mv_ventas_por_sucursal FROM authenticated;

-- Opción B: Si necesitas que sea accesible, crea políticas RLS
-- (Las vistas materializadas no soportan RLS directamente,
-- necesitarías crear una vista normal sobre la materializada)

-- =====================================================
-- 4. NOTAS SOBRE POLÍTICAS RLS PERMISIVAS
-- =====================================================
-- Las siguientes tablas tienen políticas USING (true) que no restringen acceso.
-- Esto fue intencional en el script anterior, pero deberías cambiarlas en producción:
--
-- - admission_appointments
-- - ag_alumno (la acabamos de crear así)
-- - alumno_detalles
-- - alumnos
-- - blocked_dates
-- - categorias_prendas
-- - categories
-- - compras_insumos
-- - cortes
-- - costos
-- - cotizaciones
-- - custom_periods
-- - datos_facturacion
-- - detalle_cortes
-- - detalle_cotizacion
-- - detalle_pedidos
-- - executors
-- - expediente_inicial
-- - expenses
-- - externos
-- - funds
-- - inscripciones
-- - insumos
-- - movimientos
-- - notificaciones
-- - pago_desayunos (la acabamos de crear así)
-- - pedidos
-- - person_categories
-- - personal (la acabamos de crear así)
-- - persons
-- - prendas
-- - presentaciones
-- - reservas
-- - reservas_backup (la acabamos de crear así)
-- - reservas_backup_funcion1_2025_12_02 (la acabamos de crear así)
-- - reservas_backup_funcion2_2025_12_04 (la acabamos de crear así)
-- - reservas_backup_funcion2_hoy (la acabamos de crear así)
-- - sesiones
-- - tallas
-- - taller_ia
-- - usuario_perfil
-- - wsp (la acabamos de crear así)
--
-- Ver REPORTE_SEGURIDAD.md para ejemplos de políticas más restrictivas.

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================

-- Ver funciones con search_path configurado:
-- SELECT 
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as arguments,
--   p.proconfig as config
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proconfig IS NOT NULL
-- ORDER BY p.proname;

-- Ver extensiones y sus schemas:
-- SELECT 
--   e.extname as extension_name,
--   n.nspname as schema_name
-- FROM pg_extension e
-- JOIN pg_namespace n ON n.oid = e.extnamespace
-- ORDER BY e.extname;
