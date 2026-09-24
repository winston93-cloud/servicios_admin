-- Módulos del dashboard visibles por usuario (ids de NAV_ITEMS_ADMIN).
-- NULL = cuenta legada: se usa el mapa DASHBOARD_MODULOS_OCULTOS en código.
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS dashboard_modulos TEXT[];
