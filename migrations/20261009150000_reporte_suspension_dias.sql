alter table public.reporte_suspension
  add column if not exists suspension_dias smallint not null default 1;
