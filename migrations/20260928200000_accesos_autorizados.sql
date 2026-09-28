-- Accesos Autorizados: bóveda de claves (usuario / plataforma / contraseña cifrada).
-- La contraseña se guarda cifrada (AES-256-GCM) desde el servidor; nunca en texto plano.
-- RLS activo sin políticas: solo la API key de servidor (admin) puede leer/escribir.

create table if not exists public.acceso_autorizado (
  id bigint generated always as identity primary key,
  plataforma text not null,
  categoria text not null default 'otro',
  usuario text not null default '',
  password_cifrado text,
  url text,
  responsable text,
  notas text,
  creado_por text,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acceso_autorizado_categoria_idx on public.acceso_autorizado (categoria);

create table if not exists public.acceso_autorizado_bitacora (
  id bigint generated always as identity primary key,
  acceso_id bigint,
  plataforma text,
  accion text not null,
  usuario_id integer,
  usuario_nombre text,
  created_at timestamptz not null default now()
);

create index if not exists acceso_autorizado_bitacora_fecha_idx on public.acceso_autorizado_bitacora (created_at desc);

alter table public.acceso_autorizado enable row level security;
alter table public.acceso_autorizado_bitacora enable row level security;
