-- Nivel escolar propio por maestro (1 maternal … 4 secundaria). Cada pestaña del catálogo da sus altas.

ALTER TABLE public.boleta_maestro
  ADD COLUMN IF NOT EXISTS maestro_nivel SMALLINT NOT NULL DEFAULT 4;

CREATE INDEX IF NOT EXISTS boleta_maestro_nivel_idx ON public.boleta_maestro (maestro_nivel);

COMMENT ON COLUMN public.boleta_maestro.maestro_nivel IS
  '1 maternal, 2 kinder, 3 primaria, 4 secundaria — catálogo por nivel en Servicios.';

-- Backfill desde asignaciones existentes (maestros de secundaria quedan en 4).
UPDATE public.boleta_maestro m
SET maestro_nivel = sub.materia_nivel
FROM (
  SELECT mg.maestro_id, MIN(mat.materia_nivel)::SMALLINT AS materia_nivel
  FROM public.boleta_maestro_grupo mg
  JOIN public.boleta_materia mat ON mat.materia_id = mg.materia_id
  GROUP BY mg.maestro_id
) sub
WHERE m.maestro_id = sub.maestro_id;
