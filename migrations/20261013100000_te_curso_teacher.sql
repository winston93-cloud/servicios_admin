-- Team English: cursos que la teacher sube por su cuenta desde su portal (constancia + datos);
-- la dirección los valida o rechaza. Las capacitaciones que organiza la escuela siguen en te_capacitacion.

create table if not exists public.te_curso (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel in (2, 3)),
  titulo text not null check (char_length(titulo) between 1 and 200),
  institucion text check (char_length(institucion) <= 200),
  modalidad text not null default 'en_linea' check (modalidad in ('presencial', 'en_linea', 'hibrida')),
  fecha date not null,
  horas numeric(6, 2) check (horas is null or horas between 0 and 2000),
  notas text not null default '' check (char_length(notas) <= 2000),
  archivo_key text not null,
  archivo_nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'validado', 'rechazado')),
  comentario text not null default '' check (char_length(comentario) <= 2000),
  revisado_por text,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists te_curso_nivel_idx on public.te_curso (nivel, fecha desc);
create index if not exists te_curso_maestro_idx on public.te_curso (maestro_id, fecha desc);

alter table public.te_curso enable row level security;
