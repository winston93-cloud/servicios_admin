-- Boleta Secundaria: la calificación va entera, redondeada (.5 sube, .4 baja); Classroom conserva su decimal
-- en boleta_classroom_calif_sec. Redondea lo que Classroom escribió con decimal en el ciclo actual
-- (los ciclos anteriores del legacy no se tocan).
UPDATE public.boleta_calificacion c
SET calificacion_puntos = floor(c.calificacion_puntos::numeric + 0.5)::int::text
FROM public.boleta_materia m, public.ciclos_escolares ce
WHERE m.materia_id = c.materia_id
  AND m.materia_nivel = 4
  AND ce.es_actual
  AND c.calificacion_ciclo_escolar = ce.valor
  AND c.calificacion_puntos ~ '^[0-9]+\.[0-9]+$'
  AND c.calificacion_puntos::numeric <> floor(c.calificacion_puntos::numeric);
