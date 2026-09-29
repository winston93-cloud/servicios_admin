-- Autorización para reinscribirse con adeudo del ciclo que cierra.
-- El portal abre los pasos de reinscripción y las colegiaturas del ciclo nuevo,
-- pero sigue mostrando las colegiaturas pendientes del ciclo de cierre como adeudo.

create table if not exists public.portal_autorizacion_adeudo (
  id bigint generated always as identity primary key,
  alumno_ref integer not null,
  ciclo_cierre integer not null,
  motivo text not null,
  autor text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alumno_ref, ciclo_cierre)
);

alter table public.portal_autorizacion_adeudo enable row level security;
