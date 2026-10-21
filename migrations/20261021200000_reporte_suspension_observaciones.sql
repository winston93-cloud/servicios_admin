-- Observaciones de psicología/coordinación para la familia en el aviso de suspensión (los 3 niveles).
alter table public.reporte_suspension
  add column if not exists suspension_observaciones text;
