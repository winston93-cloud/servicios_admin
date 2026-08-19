-- Bucket temporal para adjuntos de correo masivo (subida por archivo, borrado tras envío).
-- Ejecutar en InsForge SQL Editor si el bucket no existe aún.

insert into storage.buckets (id, name, public)
values ('correo-masivo-temp', 'correo-masivo-temp', false)
on conflict (id) do nothing;

-- Admin SDK (INSFORGE_API_KEY) opera sin RLS; políticas opcionales para auditoría.
