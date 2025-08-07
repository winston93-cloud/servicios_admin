-- Optimizaciones para la tabla alumno
-- Ejecutar estos comandos en Supabase SQL Editor

-- 1. Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_alumno_app ON alumno USING gin (alumno_app gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumno_apm ON alumno USING gin (alumno_apm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumno_nombre ON alumno USING gin (alumno_nombre gin_trgm_ops);

-- 2. Crear índice específico para alumno_nombre_completo (NUEVO)
CREATE INDEX IF NOT EXISTS idx_alumno_nombre_completo ON alumno USING gin (alumno_nombre_completo gin_trgm_ops);

-- 3. Crear índices para filtros
CREATE INDEX IF NOT EXISTS idx_alumno_ciclo_escolar ON alumno (alumno_ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_alumno_status ON alumno (alumno_status);

-- 4. Crear índice compuesto para búsqueda en múltiples campos
CREATE INDEX IF NOT EXISTS idx_alumno_search ON alumno USING gin (
  (alumno_app || ' ' || alumno_apm || ' ' || alumno_nombre) gin_trgm_ops
);

-- 5. Crear índice compuesto para filtros + búsqueda en nombre_completo (NUEVO)
CREATE INDEX IF NOT EXISTS idx_alumno_filtered_nombre_completo ON alumno (
  alumno_ciclo_escolar, 
  alumno_status
) WHERE alumno_ciclo_escolar = '22' AND alumno_status = 1;

-- 6. Habilitar extensión pg_trgm si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 7. Optimizar configuración de PostgreSQL para búsquedas
-- (Estos se configuran en Supabase Dashboard > Settings > Database)

-- 8. Crear función para búsqueda optimizada usando alumno_nombre_completo (ACTUALIZADA)
CREATE OR REPLACE FUNCTION search_alumnos_optimized(search_query TEXT)
RETURNS TABLE(
  alumno_id INTEGER,
  alumno_ref TEXT,
  alumno_app TEXT,
  alumno_apm TEXT,
  alumno_nombre TEXT,
  alumno_nivel TEXT,
  alumno_nombre_completo TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.alumno_id,
    a.alumno_ref,
    a.alumno_app,
    a.alumno_apm,
    a.alumno_nombre,
    a.alumno_nivel,
    a.alumno_nombre_completo,
    similarity(a.alumno_nombre_completo, search_query) as similarity_score
  FROM alumno a
  WHERE 
    a.alumno_ciclo_escolar = '22' AND
    a.alumno_status = 1 AND
    a.alumno_nombre_completo ILIKE '%' || search_query || '%'
  ORDER BY similarity_score DESC, a.alumno_nombre_completo ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 9. Analizar tabla para optimizar estadísticas
ANALYZE alumno;
