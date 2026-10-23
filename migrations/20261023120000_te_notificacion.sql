-- Team English: campanita de las teachers (Mario, 23 oct 2026; pedido de English Elementary Coordination).
-- La planeación de la semana siguiente se entrega el jueves (la directora la revisa ese día y se libera el viernes):
-- el miércoles avisa «mañana entregas» y el jueves, en rojo, «hoy entregas», por grado que aún no la manda.
-- Las teachers son boleta_maestro (no usuario), por eso no usan notificacion_empleado.

create table if not exists public.te_notificacion (
  id bigint generated always as identity primary key,
  maestro_id integer not null,
  tipo text not null check (tipo in ('plan_manana', 'plan_hoy')),
  urgencia text not null default 'aviso' check (urgencia in ('aviso', 'urgente')),
  asunto text not null check (char_length(asunto) between 1 and 200),
  mensaje text not null default '' check (char_length(mensaje) <= 2000),
  semana date not null,
  grado smallint not null,
  leida boolean not null default false,
  leida_at timestamptz,
  -- 'entendido' (la teacher la cerró) o 'entregada' (mandó la planeación y se quitó sola).
  cierre text check (cierre in ('entendido', 'entregada')),
  prueba boolean not null default false,
  created_at timestamptz not null default now(),
  unique (maestro_id, tipo, semana, grado)
);
create index if not exists te_notificacion_maestro_idx on public.te_notificacion (maestro_id, leida, created_at desc);

alter table public.te_notificacion enable row level security;
