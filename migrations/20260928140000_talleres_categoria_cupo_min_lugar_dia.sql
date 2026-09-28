-- Talleres: categoría (Concurso, Deportivo, Artístico…), cupo mínimo y lugar por día.
ALTER TABLE public.taller ADD COLUMN IF NOT EXISTS categoria VARCHAR(40);

ALTER TABLE public.taller_asignacion ADD COLUMN IF NOT EXISTS cupo_min INTEGER
  CHECK (cupo_min IS NULL OR cupo_min > 0);

-- Si es NULL se usa taller_asignacion.lugar.
ALTER TABLE public.taller_horario ADD COLUMN IF NOT EXISTS lugar VARCHAR(80);
