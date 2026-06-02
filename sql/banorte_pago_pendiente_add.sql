-- Monto pendiente entre formulario 3D Secure y comercio electrónico (legacy: tabla montos MySQL)
create table if not exists public.banorte_pago_pendiente (
  referencia text primary key,
  monto numeric(12, 2) not null,
  creado_en timestamptz not null default now()
);

create index if not exists banorte_pago_pendiente_creado_en_idx
  on public.banorte_pago_pendiente (creado_en desc);

comment on table public.banorte_pago_pendiente is
  'Importe acordado al iniciar pago Banorte; usado al volver de 3D Secure (REFERENCIA3D).';
