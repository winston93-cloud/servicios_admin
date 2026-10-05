-- Revertir tablas de admisión creadas por error en Winston Servicios.
-- Deben vivir solo en el proyecto InsForge AgendaW.
DROP TABLE IF EXISTS public.admission_permission_requests CASCADE;
DROP TABLE IF EXISTS public.expediente_inicial CASCADE;
DROP TABLE IF EXISTS public.tour_recorridos CASCADE;
DROP TABLE IF EXISTS public.wsp CASCADE;
DROP TABLE IF EXISTS public.admission_appointments CASCADE;
DROP TABLE IF EXISTS public.blocked_dates CASCADE;
DROP TABLE IF EXISTS public.admission_schedules CASCADE;
DROP FUNCTION IF EXISTS public.agendaw_set_updated_at() CASCADE;
