-- Boletas Secundaria: catálogo editable (sección SET/Winston, promedio, semáforo, comprensión lectora),
-- entrega a dirección por materia + grado + grupo, y comprensión lectora por mes (solo Español).

ALTER TABLE public.boleta_materia
  ADD COLUMN IF NOT EXISTS materia_seccion text,
  ADD COLUMN IF NOT EXISTS materia_en_promedio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS materia_semaforo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS materia_comprension boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS materia_activa boolean NOT NULL DEFAULT true;

ALTER TABLE public.boleta_materia DROP CONSTRAINT IF EXISTS boleta_materia_seccion_check;
ALTER TABLE public.boleta_materia
  ADD CONSTRAINT boleta_materia_seccion_check CHECK (materia_seccion IS NULL OR materia_seccion IN ('set', 'winston'));

-- Legacy: orden 1–10 = SET (oficiales SEP), 11+ = Winston. Mindfulness (45–47) va en color y fuera de promedios.
UPDATE public.boleta_materia
SET materia_seccion = CASE WHEN materia_orden BETWEEN 1 AND 10 THEN 'set' ELSE 'winston' END
WHERE materia_nivel = 4 AND materia_seccion IS NULL;

UPDATE public.boleta_materia
SET materia_en_promedio = false, materia_semaforo = true
WHERE materia_nivel = 4 AND materia_id IN (45, 46, 47);

UPDATE public.boleta_materia
SET materia_comprension = true
WHERE materia_nivel = 4 AND materia_id IN (1, 2, 3);

-- Entrega a dirección: en secundaria cada maestro envía su materia por grupo (kinder/primaria usan 0).
ALTER TABLE public.boleta_entrega ADD COLUMN IF NOT EXISTS materia_id integer NOT NULL DEFAULT 0;
ALTER TABLE public.boleta_entrega DROP CONSTRAINT IF EXISTS boleta_entrega_pkey;
ALTER TABLE public.boleta_entrega ADD PRIMARY KEY (ciclo, modulo, trimestre, grado, grupo, materia_id);

-- Comprensión lectora (legacy: mes 1=Ago, 2=Nov, 3=Mar, 4=Jun; 3 preguntas; 1=Siempre … 4=Requiere apoyo).
CREATE TABLE IF NOT EXISTS public.boleta_comprension_secundaria (
  alumno_id integer NOT NULL REFERENCES public.alumno(alumno_id) ON DELETE CASCADE,
  ciclo smallint NOT NULL,
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 4),
  p1 smallint CHECK (p1 BETWEEN 1 AND 4),
  p2 smallint CHECK (p2 BETWEEN 1 AND 4),
  p3 smallint CHECK (p3 BETWEEN 1 AND 4),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo, mes)
);

ALTER TABLE public.boleta_comprension_secundaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleta_comprension_secundaria FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.boleta_comprension_secundaria;
CREATE POLICY servicios_insforge_deny_anon ON public.boleta_comprension_secundaria
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.boleta_comprension_secundaria FROM anon, authenticated;
