-- Bitácora de cartas de suspensión enviadas desde /servicios (una fila por alumno y envío).
create table if not exists public.suspension_envio_log (
  id bigserial primary key,
  enviado_en timestamptz not null default now(),
  enviado_por text,
  plantel smallint not null,
  tipo smallint not null,
  fecha_cartas date,
  alumno_id integer,
  alumno_ref text,
  alumno_nombre text,
  nivel smallint,
  adeudos text,
  destinatarios text[] not null default '{}',
  ok boolean not null,
  mensaje text,
  modo_prueba boolean not null default false
);

create index if not exists suspension_envio_log_enviado_en_idx on public.suspension_envio_log (enviado_en desc);
create index if not exists suspension_envio_log_alumno_idx on public.suspension_envio_log (alumno_id, enviado_en desc);

alter table public.suspension_envio_log enable row level security;
