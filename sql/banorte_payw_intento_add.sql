-- Registro de intentos fallidos Payworks (comercio electrónico)
create table if not exists public.banorte_payw_intento (
  id bigint generated always as identity primary key,
  referencia text not null,
  importe numeric(12, 2),
  payw_result text,
  payw_code text,
  auth_result text,
  auth_code text,
  mensaje_es text not null,
  mensaje_raw text,
  creado_en timestamptz not null default now()
);

create index if not exists banorte_payw_intento_referencia_idx
  on public.banorte_payw_intento (referencia, creado_en desc);

comment on table public.banorte_payw_intento is
  'Intentos rechazados de cargo Banorte Payworks (Anexo A PAYW_CODE).';
