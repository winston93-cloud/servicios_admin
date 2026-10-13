-- Planeación por PDF (procesada a días/materias) y publicación programada en Google Classroom.
alter table public.te_planeacion
  add column if not exists origen text not null default 'lienzo' check (origen in ('lienzo', 'pdf')),
  add column if not exists procesado_at timestamptz,
  add column if not exists proceso_error text check (proceso_error is null or char_length(proceso_error) <= 500),
  add column if not exists classroom jsonb;

-- Lo que se creó en Classroom por planeación, para no duplicar y poder retirarlo.
create table if not exists public.te_planeacion_gclass (
  id bigint generated always as identity primary key,
  planeacion_id bigint not null references public.te_planeacion (id) on delete cascade,
  maestro_id integer not null,
  course_id text not null,
  fecha date not null,
  topic_id text,
  item_id text not null,
  titulo text not null default '',
  programado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, item_id)
);
create index if not exists te_planeacion_gclass_plan_idx on public.te_planeacion_gclass (planeacion_id);
alter table public.te_planeacion_gclass enable row level security;
