-- Paquetes e.firma (FIEL) para descarga masiva SAT — solo servidor (admin API key)

CREATE TABLE IF NOT EXISTS public.sat_fiel_paquete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(80) NOT NULL,
  cer_base64 TEXT NOT NULL,
  key_base64 TEXT NOT NULL,
  cer_nombre VARCHAR(255) NOT NULL,
  key_nombre VARCHAR(255) NOT NULL,
  password_cifrado TEXT NOT NULL,
  creado_por VARCHAR(120),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sat_fiel_paquete_nombre ON public.sat_fiel_paquete (nombre);
CREATE INDEX IF NOT EXISTS idx_sat_fiel_paquete_actualizado ON public.sat_fiel_paquete (actualizado_en DESC);

CREATE OR REPLACE FUNCTION public.set_sat_fiel_paquete_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sat_fiel_paquete_actualizado_en ON public.sat_fiel_paquete;
CREATE TRIGGER trg_sat_fiel_paquete_actualizado_en
  BEFORE UPDATE ON public.sat_fiel_paquete
  FOR EACH ROW EXECUTE FUNCTION public.set_sat_fiel_paquete_actualizado_en();

ALTER TABLE public.sat_fiel_paquete ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sat_fiel_paquete FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.sat_fiel_paquete;
CREATE POLICY servicios_insforge_deny_anon ON public.sat_fiel_paquete
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

REVOKE ALL ON public.sat_fiel_paquete FROM anon, authenticated;
