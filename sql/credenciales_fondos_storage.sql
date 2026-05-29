-- Bucket opcional para fondos personalizados de credenciales (persistencia en Vercel).
-- Ejecutar en Supabase SQL Editor si usas deploy en la nube.

insert into storage.buckets (id, name, public)
values ('credenciales-fondos', 'credenciales-fondos', true)
on conflict (id) do nothing;

create policy "Lectura pública fondos credenciales"
on storage.objects for select
using (bucket_id = 'credenciales-fondos');

create policy "Subida fondos credenciales autenticados"
on storage.objects for insert
with check (bucket_id = 'credenciales-fondos');

create policy "Actualizar fondos credenciales"
on storage.objects for update
using (bucket_id = 'credenciales-fondos');
