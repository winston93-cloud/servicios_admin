-- El panel de control nunca debe cargar la base de producción: su lectura se corta a los 3 s
-- y no espera candados de otras operaciones.
ALTER FUNCTION public.panel_control_metricas() SET statement_timeout = '3s';
ALTER FUNCTION public.panel_control_metricas() SET lock_timeout = '500ms';
