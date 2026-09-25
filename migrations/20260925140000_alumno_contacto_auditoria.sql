-- 2026-09-25: Historial append-only de familiares / contactos (quién recoge, comunicados).
-- No altera semántica de alumno_familiar / alumno_contacto.
-- Nota: InsForge no permite set_config en sesión; el actor se escribe desde la app
-- (staff/portal). No hay trigger de respaldo en este entorno.

CREATE TABLE IF NOT EXISTS public.alumno_contacto_auditoria (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_tipo text NOT NULL CHECK (actor_tipo IN ('staff', 'portal', 'sistema')),
  actor_id text NULL,
  actor_label text NOT NULL DEFAULT '',
  accion text NOT NULL,
  entidad text NOT NULL CHECK (entidad IN ('alumno_familiar', 'alumno_contacto')),
  entidad_id integer NULL,
  alumno_id integer NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text NULL,
  user_agent text NULL
);

CREATE INDEX IF NOT EXISTS alumno_contacto_auditoria_alumno_created_idx
  ON public.alumno_contacto_auditoria (alumno_id, created_at DESC);

CREATE INDEX IF NOT EXISTS alumno_contacto_auditoria_entidad_idx
  ON public.alumno_contacto_auditoria (entidad, entidad_id);

CREATE INDEX IF NOT EXISTS alumno_contacto_auditoria_accion_idx
  ON public.alumno_contacto_auditoria (accion, created_at DESC);

ALTER TABLE public.alumno_contacto_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumno_contacto_auditoria FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.alumno_contacto_auditoria;
CREATE POLICY servicios_insforge_deny_anon ON public.alumno_contacto_auditoria
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.alumno_contacto_auditoria FROM anon, authenticated;
