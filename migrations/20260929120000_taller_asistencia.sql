-- Pase de lista diario por grupo de taller.
-- Una fila por grupo y fecha: conteo de alumnos en el salón + faltas (alumno_id).

create table if not exists public.taller_asistencia (
  id bigint generated always as identity primary key,
  asignacion_id integer not null references public.taller_asignacion(id) on delete cascade,
  fecha date not null,
  total_alumnos integer check (total_alumnos is null or total_alumnos between 0 and 500),
  faltas integer[] not null default '{}',
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asignacion_id, fecha)
);

create index if not exists taller_asistencia_fecha_idx on public.taller_asistencia (fecha);

alter table public.taller_asistencia enable row level security;
