-- Team English: seguimiento de teachers de inglés (Kinder = nivel 2, Primaria = nivel 3).
-- Las teachers son boleta_maestro; el equipo sale de su asignación «Teacher» + altas manuales.

create table if not exists public.te_teacher (
  maestro_id integer primary key,
  nivel smallint not null check (nivel in (2, 3)),
  -- true = alta manual (no tiene asignación Teacher); false = solo perfil de una teacher asignada.
  manual boolean not null default false,
  activo boolean not null default true,
  emoji text not null default '🌷' check (char_length(emoji) <= 16),
  puesto text check (char_length(puesto) <= 120),
  fecha_ingreso date,
  telefono text check (char_length(telefono) <= 40),
  formacion text check (char_length(formacion) <= 2000),
  certificaciones text check (char_length(certificaciones) <= 2000),
  nivel_ingles text check (char_length(nivel_ingles) <= 40),
  notas text check (char_length(notas) <= 4000),
  cv_key text,
  cv_nombre text,
  foto_key text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.te_antecedente (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel in (2, 3)),
  fecha date not null,
  tipo text not null check (tipo in ('reconocimiento', 'observacion', 'llamada_atencion', 'acta', 'incidente', 'entrevista', 'otro')),
  titulo text not null check (char_length(titulo) between 1 and 200),
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  archivo_key text,
  archivo_nombre text,
  registrado_por text,
  created_at timestamptz not null default now()
);
create index if not exists te_antecedente_maestro_idx on public.te_antecedente (maestro_id, fecha desc);

create table if not exists public.te_planeacion (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel in (2, 3)),
  grado smallint not null check (grado between 1 and 6),
  semana date not null, -- lunes de la semana
  titulo text not null default '' check (char_length(titulo) <= 200),
  notas text not null default '' check (char_length(notas) <= 3000),
  archivo_key text,
  archivo_nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'cambios')),
  comentario text not null default '' check (char_length(comentario) <= 3000),
  version integer not null default 1,
  subido_por text,
  subido_rol text not null default 'teacher' check (subido_rol in ('teacher', 'directora')),
  revisado_por text,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (maestro_id, grado, semana)
);
create index if not exists te_planeacion_semana_idx on public.te_planeacion (nivel, semana desc);

create table if not exists public.te_capacitacion (
  id bigint generated always as identity primary key,
  nivel smallint not null check (nivel in (2, 3)),
  titulo text not null check (char_length(titulo) between 1 and 200),
  tipo text not null check (tipo in ('interna', 'externa')),
  modalidad text not null default 'presencial' check (modalidad in ('presencial', 'en_linea', 'hibrida')),
  proveedor text check (char_length(proveedor) <= 200),
  fecha_inicio date not null,
  fecha_fin date,
  horas numeric(6, 2) check (horas is null or horas between 0 and 2000),
  lugar text check (char_length(lugar) <= 200),
  descripcion text not null default '' check (char_length(descripcion) <= 3000),
  estado text not null default 'programada' check (estado in ('programada', 'realizada', 'cancelada')),
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists te_capacitacion_fecha_idx on public.te_capacitacion (nivel, fecha_inicio desc);

create table if not exists public.te_capacitacion_teacher (
  capacitacion_id bigint not null references public.te_capacitacion(id) on delete cascade,
  maestro_id integer not null,
  asistio boolean,
  constancia_key text,
  constancia_nombre text,
  primary key (capacitacion_id, maestro_id)
);

create table if not exists public.te_incidencia (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel in (2, 3)),
  fecha date not null,
  tipo text not null check (tipo in ('falta', 'retardo', 'permiso_llegada', 'permiso_salida', 'enfermedad')),
  minutos integer check (minutos is null or minutos between 0 and 600),
  justificada boolean not null default false,
  notas text not null default '' check (char_length(notas) <= 1000),
  registrado_por text,
  created_at timestamptz not null default now(),
  unique (maestro_id, fecha, tipo)
);
create index if not exists te_incidencia_fecha_idx on public.te_incidencia (nivel, fecha);

create table if not exists public.te_config (
  nivel smallint primary key check (nivel in (2, 3)),
  -- Pesos (suman 100) por rubro de desempeño.
  ponderadores jsonb not null default '{"asistencia":40,"retardos":25,"permisos":20,"enfermedad":15}',
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.te_config (nivel) values (2), (3) on conflict (nivel) do nothing;

create table if not exists public.te_classroom (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel in (2, 3)),
  semana date not null,
  grupo text not null check (char_length(grupo) between 1 and 10),
  actualizado boolean not null default false,
  actividades_calificadas boolean not null default false,
  trabajos_revisados boolean not null default false,
  notas text not null default '' check (char_length(notas) <= 1000),
  revisado_por text,
  updated_at timestamptz not null default now(),
  unique (maestro_id, semana, grupo)
);
create index if not exists te_classroom_semana_idx on public.te_classroom (nivel, semana);

alter table public.te_teacher enable row level security;
alter table public.te_antecedente enable row level security;
alter table public.te_planeacion enable row level security;
alter table public.te_capacitacion enable row level security;
alter table public.te_capacitacion_teacher enable row level security;
alter table public.te_incidencia enable row level security;
alter table public.te_config enable row level security;
alter table public.te_classroom enable row level security;
