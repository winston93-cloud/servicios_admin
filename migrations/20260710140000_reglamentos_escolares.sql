-- Reglamentos escolares (PDF por nivel + ciclo) — metadata en DB, archivo en bucket reglamentos-escolares

CREATE TABLE IF NOT EXISTS public.reglamentos_escolares (
  id bigserial PRIMARY KEY,
  nivel smallint NOT NULL CHECK (nivel BETWEEN 1 AND 4),
  ciclo_valor integer NOT NULL,
  storage_key text NOT NULL,
  storage_url text NOT NULL,
  nombre_archivo text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reglamentos_escolares_nivel_ciclo_unique UNIQUE (nivel, ciclo_valor)
);

CREATE INDEX IF NOT EXISTS reglamentos_escolares_ciclo_idx
  ON public.reglamentos_escolares (ciclo_valor);

ALTER TABLE public.reglamentos_escolares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reglamentos_escolares FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.reglamentos_escolares;
CREATE POLICY servicios_insforge_deny_anon ON public.reglamentos_escolares
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.reglamentos_escolares FROM anon, authenticated;
