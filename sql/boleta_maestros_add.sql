-- =============================================================================
-- Boletas / credenciales de maestros (MySQL winston_general → Supabase)
-- Importar datos:
--   node scripts/import-boleta-supabase.mjs [materia.csv] [maestro.csv] [grupo.csv]
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.boleta_materia (
  materia_id INTEGER PRIMARY KEY,
  materia_nombre VARCHAR(120) NOT NULL,
  materia_nivel SMALLINT NOT NULL,
  materia_grado SMALLINT NOT NULL,
  materia_orden SMALLINT NOT NULL DEFAULT 0,
  materia_registro DATE
);

CREATE TABLE IF NOT EXISTS public.boleta_maestro (
  maestro_id INTEGER PRIMARY KEY,
  maestro_app VARCHAR(80),
  maestro_apm VARCHAR(80),
  maestro_nombre VARCHAR(80),
  maestro_usuario VARCHAR(40),
  maestro_clave VARCHAR(80),
  maestro_sexo SMALLINT NOT NULL DEFAULT 0,
  maestro_celular VARCHAR(20),
  maestro_registro DATE,
  maestro_email VARCHAR(120),
  maestro_nivel SMALLINT NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS public.boleta_maestro_grupo (
  grupo_id INTEGER PRIMARY KEY,
  maestro_id INTEGER NOT NULL REFERENCES public.boleta_maestro (maestro_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  grupo_letra VARCHAR(10),
  grupo_registro DATE
);

CREATE INDEX IF NOT EXISTS boleta_materia_nivel ON public.boleta_materia (materia_nivel, materia_grado);
CREATE INDEX IF NOT EXISTS boleta_maestro_grupo_maestro ON public.boleta_maestro_grupo (maestro_id);
CREATE INDEX IF NOT EXISTS boleta_maestro_grupo_materia ON public.boleta_maestro_grupo (materia_id);

COMMENT ON TABLE public.boleta_materia IS 'Catálogo de materias (legacy boletas).';
COMMENT ON TABLE public.boleta_maestro IS 'Maestros para credenciales y boletas (legacy).';
COMMENT ON TABLE public.boleta_maestro_grupo IS 'Asignación maestro–materia–grupo (legacy).';
