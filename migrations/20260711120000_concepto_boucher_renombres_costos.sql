-- Renombrar conceptos de costos usados en portal / bauchers
UPDATE public.concepto_boucher
SET concepto_clase = 'Cuota de inicio de ciclo escolar'
WHERE concepto_no IN ('00', '0', 0)
   OR TRIM(CAST(concepto_no AS text)) = '00';

UPDATE public.concepto_boucher
SET concepto_clase = 'Evaluación y Herramientas Tecnológicas'
WHERE TRIM(CAST(concepto_no AS text)) IN ('17');
