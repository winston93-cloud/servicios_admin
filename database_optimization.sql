-- Optimizaciones para la tabla alumno
-- Ejecutar estos comandos en Supabase SQL Editor

-- 1. Crear índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_alumno_app ON alumno USING gin (alumno_app gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumno_apm ON alumno USING gin (alumno_apm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_alumno_nombre ON alumno USING gin (alumno_nombre gin_trgm_ops);

-- 2. Crear índices para filtros
CREATE INDEX IF NOT EXISTS idx_alumno_ciclo_escolar ON alumno (alumno_ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_alumno_status ON alumno (alumno_status);

-- 3. Crear índice compuesto para búsqueda en múltiples campos
CREATE INDEX IF NOT EXISTS idx_alumno_search ON alumno USING gin (
  (alumno_app || ' ' || alumno_apm || ' ' || alumno_nombre) gin_trgm_ops
);

-- 4. Crear índice compuesto para filtros + búsqueda
CREATE INDEX IF NOT EXISTS idx_alumno_filtered_search ON alumno (
  alumno_ciclo_escolar, 
  alumno_status
) WHERE alumno_ciclo_escolar = '22' AND alumno_status = 1;

-- 3. Habilitar extensión pg_trgm si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Optimizar configuración de PostgreSQL para búsquedas
-- (Estos se configuran en Supabase Dashboard > Settings > Database)

-- 5. Crear función para búsqueda optimizada
CREATE OR REPLACE FUNCTION search_alumnos_optimized(search_query TEXT)
RETURNS TABLE(
  alumno_id INTEGER,
  alumno_ref TEXT,
  alumno_app TEXT,
  alumno_apm TEXT,
  alumno_nombre TEXT,
  alumno_nivel TEXT,
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
    GREATEST(
      similarity(a.alumno_app, search_query),
      similarity(a.alumno_apm, search_query),
      similarity(a.alumno_nombre, search_query)
    ) as similarity_score
  FROM alumno a
  WHERE 
    a.alumno_ciclo_escolar = '22' AND
    a.alumno_status = 1 AND
    (a.alumno_app ILIKE '%' || search_query || '%' OR
    a.alumno_apm ILIKE '%' || search_query || '%' OR
    a.alumno_nombre ILIKE '%' || search_query || '%')
  ORDER BY similarity_score DESC, a.alumno_app ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- 6. Analizar tabla para optimizar estadísticas
ANALYZE alumno;
