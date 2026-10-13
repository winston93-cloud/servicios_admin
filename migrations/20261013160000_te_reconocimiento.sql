-- Team English: reconocimientos y eventos de la semana que publica la directora. Las teachers los ven
-- al entrar a su portal en un modal de 5 s con efectos (confeti, fuegos, serpentinas, piñata…), sonido y temblor.

create table if not exists public.te_reconocimiento (
  id bigint generated always as identity primary key,
  nivel smallint not null check (nivel in (2, 3)),
  semana date not null,
  titulo text not null check (char_length(titulo) between 1 and 120),
  mensaje text not null default '' check (char_length(mensaje) <= 600),
  emoji text not null default '🏆' check (char_length(emoji) <= 16),
  maestro_ids integer[] not null default '{}',
  efectos text[] not null default '{confeti}' check (
    cardinality(efectos) between 1 and 6
    and efectos <@ array['confeti', 'fuegos', 'serpentinas', 'pinata', 'globos', 'estrellas']::text[]
  ),
  tema text not null default 'arcoiris' check (tema in ('arcoiris', 'neon', 'oro', 'galaxia')),
  sonido boolean not null default true,
  temblor boolean not null default true,
  foto_key text,
  creado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists te_reconocimiento_nivel_idx on public.te_reconocimiento (nivel, semana desc);

create table if not exists public.te_reconocimiento_visto (
  reconocimiento_id bigint not null references public.te_reconocimiento (id) on delete cascade,
  maestro_id integer not null,
  visto_at timestamptz not null default now(),
  reaccion text check (reaccion in ('aplauso', 'corazon', 'fiesta', 'estrella')),
  primary key (reconocimiento_id, maestro_id)
);

alter table public.te_reconocimiento enable row level security;
alter table public.te_reconocimiento_visto enable row level security;
