-- Team English: apodo de la teacher («Miss Maru») y colección de stickers propios que sube la directora.
-- El sticker elegido convive con el emoji: en textos se usa el emoji y en el avatar la imagen.

create table if not exists public.te_sticker (
  id bigint generated always as identity primary key,
  nivel smallint not null check (nivel in (2, 3)),
  key text not null,
  nombre text not null default '' check (char_length(nombre) <= 180),
  creado_por text,
  created_at timestamptz not null default now()
);
create index if not exists te_sticker_nivel_idx on public.te_sticker (nivel, id);

alter table public.te_teacher add column if not exists apodo text check (char_length(apodo) <= 60);
alter table public.te_teacher add column if not exists sticker_id bigint references public.te_sticker (id) on delete set null;

alter table public.te_sticker enable row level security;
