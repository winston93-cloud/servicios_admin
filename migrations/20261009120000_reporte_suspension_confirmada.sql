-- Confirmación de enterado del aviso de suspensión (antes se marcaba el reporte que la detonó).
alter table public.reporte_suspension
  add column if not exists suspension_confirmada smallint not null default 0;
