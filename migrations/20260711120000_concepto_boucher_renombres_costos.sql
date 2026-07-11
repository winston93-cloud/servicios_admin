-- Renombrar conceptos de costos usados en portal / bauchers
UPDATE public.concepto_boucher
SET concepto_clase = 'Cuota de Inicio de Curso'
WHERE TRIM(concepto_no::text) IN ('00', '0');

UPDATE public.concepto_boucher
SET concepto_clase = 'Herramientas Tecnológicas y Evaluaciones'
WHERE TRIM(concepto_no::text) = '17';
