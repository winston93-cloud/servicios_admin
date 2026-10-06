-- Team English: expediente personal de la teacher.
-- te_expediente = datos generales (uno por teacher); te_expediente_item = registros individuales
-- (formación, certificaciones, experiencia, contactos de emergencia y documentos).

create table if not exists public.te_expediente (
  maestro_id integer primary key,
  nivel smallint not null check (nivel = 3),
  datos jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.te_expediente_item (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  nivel smallint not null check (nivel = 3),
  tipo text not null check (tipo in ('formacion', 'certificacion', 'experiencia', 'contacto', 'documento')),
  datos jsonb not null default '{}'::jsonb,
  archivo_key text,
  archivo_nombre text,
  registrado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists te_expediente_item_maestro_idx on public.te_expediente_item (maestro_id, tipo);

-- Solo el servidor (API key) lee y escribe: contiene datos personales.
alter table public.te_expediente enable row level security;
alter table public.te_expediente_item enable row level security;
