-- =====================================================
-- SCRIPT PARA SOLUCIONAR PROBLEMAS DE SEGURIDAD
-- Base de datos: desayunos
-- Fecha: 2026-02-11
-- =====================================================

-- =====================================================
-- 1. HABILITAR RLS EN TABLAS PÚBLICAS
-- =====================================================

-- Tabla: personal
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

-- Tabla: auditoria
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Tabla: pago_desayunos (ya tiene políticas, solo falta habilitar RLS)
ALTER TABLE public.pago_desayunos ENABLE ROW LEVEL SECURITY;

-- Tabla: reservas_backup
ALTER TABLE public.reservas_backup ENABLE ROW LEVEL SECURITY;

-- Tabla: wsp
ALTER TABLE public.wsp ENABLE ROW LEVEL SECURITY;

-- Tabla: reservas_backup_funcion2_hoy
ALTER TABLE public.reservas_backup_funcion2_hoy ENABLE ROW LEVEL SECURITY;

-- Tabla: reservas_backup_funcion2_2025_12_04
ALTER TABLE public.reservas_backup_funcion2_2025_12_04 ENABLE ROW LEVEL SECURITY;

-- Tabla: reservas_backup_funcion1_2025_12_02
ALTER TABLE public.reservas_backup_funcion1_2025_12_02 ENABLE ROW LEVEL SECURITY;

-- Tabla: ag_alumno
ALTER TABLE public.ag_alumno ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CREAR POLÍTICAS RLS BÁSICAS
-- =====================================================
-- IMPORTANTE: Estas políticas permiten acceso completo.
-- Ajusta según tus necesidades de seguridad específicas.

-- Políticas para personal
DROP POLICY IF EXISTS "Allow public access" ON public.personal;
CREATE POLICY "Allow public access" 
  ON public.personal 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para auditoria (generalmente solo lectura)
DROP POLICY IF EXISTS "Allow read access" ON public.auditoria;
CREATE POLICY "Allow read access" 
  ON public.auditoria 
  FOR SELECT 
  USING (true);

-- pago_desayunos ya tiene la política "Allow public access"
-- Solo necesitaba habilitar RLS (hecho arriba)

-- Políticas para reservas_backup
DROP POLICY IF EXISTS "Allow public access" ON public.reservas_backup;
CREATE POLICY "Allow public access" 
  ON public.reservas_backup 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para wsp
DROP POLICY IF EXISTS "Allow public access" ON public.wsp;
CREATE POLICY "Allow public access" 
  ON public.wsp 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para reservas_backup_funcion2_hoy
DROP POLICY IF EXISTS "Allow public access" ON public.reservas_backup_funcion2_hoy;
CREATE POLICY "Allow public access" 
  ON public.reservas_backup_funcion2_hoy 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para reservas_backup_funcion2_2025_12_04
DROP POLICY IF EXISTS "Allow public access" ON public.reservas_backup_funcion2_2025_12_04;
CREATE POLICY "Allow public access" 
  ON public.reservas_backup_funcion2_2025_12_04 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para reservas_backup_funcion1_2025_12_02
DROP POLICY IF EXISTS "Allow public access" ON public.reservas_backup_funcion1_2025_12_02;
CREATE POLICY "Allow public access" 
  ON public.reservas_backup_funcion1_2025_12_02 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Políticas para ag_alumno
DROP POLICY IF EXISTS "Allow public access" ON public.ag_alumno;
CREATE POLICY "Allow public access" 
  ON public.ag_alumno 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- =====================================================
-- 3. SOLUCIÓN PARA VISTAS SECURITY DEFINER
-- =====================================================
-- Las vistas con SECURITY DEFINER pueden ser un problema de seguridad
-- OPCIONES:
-- A) Eliminar SECURITY DEFINER (recomendado si no es necesario)
-- B) Mantenerlo pero agregar políticas RLS en las tablas subyacentes

-- Para recrear las vistas SIN security definer, necesitarías:
-- 1. Obtener la definición actual de cada vista
-- 2. Eliminar la vista
-- 3. Recrearla sin SECURITY DEFINER

-- Ejemplo para v_expenses_by_category:
-- DROP VIEW IF EXISTS public.v_expenses_by_category;
-- CREATE OR REPLACE VIEW public.v_expenses_by_category AS
-- SELECT ... -- (aquí iría la definición completa de la vista)

-- NOTA: No incluyo la recreación de vistas porque necesitaría
-- conocer su definición completa. Puedes obtenerla con:
-- SELECT pg_get_viewdef('public.v_expenses_by_category', true);

-- =====================================================
-- 4. LIMPIEZA DE TABLAS BACKUP (OPCIONAL)
-- =====================================================
-- Las tablas de backup antiguas pueden eliminarse si ya no son necesarias:

-- DROP TABLE IF EXISTS public.reservas_backup;
-- DROP TABLE IF EXISTS public.reservas_backup_funcion2_hoy;
-- DROP TABLE IF EXISTS public.reservas_backup_funcion2_2025_12_04;
-- DROP TABLE IF EXISTS public.reservas_backup_funcion1_2025_12_02;

-- =====================================================
-- 5. VERIFICACIÓN
-- =====================================================
-- Ejecuta estas queries para verificar que todo esté correcto:

-- Ver tablas con RLS habilitado:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- Ver políticas RLS:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, policyname;

-- Ver vistas con SECURITY DEFINER:
-- SELECT 
--   n.nspname as schema,
--   c.relname as view_name,
--   CASE 
--     WHEN v.security_invoker THEN 'INVOKER'
--     ELSE 'DEFINER'
--   END as security_type
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- LEFT JOIN pg_views v ON v.schemaname = n.nspname AND v.viewname = c.relname
-- WHERE c.relkind = 'v' AND n.nspname = 'public';
