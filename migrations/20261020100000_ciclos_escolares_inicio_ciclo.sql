-- Fecha en que el ciclo pasó a ser el actual (cambio de ciclo). Se llena sola al marcar es_actual.
-- La usa el aviso de inscripción sin pagar: los 30 días cuentan desde la más reciente entre esta fecha
-- y la de referencia del alumno (alumno_registro).

ALTER TABLE public.ciclos_escolares ADD COLUMN IF NOT EXISTS inicio_ciclo date;

CREATE OR REPLACE FUNCTION public.ciclos_escolares_marcar_inicio_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.es_actual IS TRUE AND (TG_OP = 'INSERT' OR OLD.es_actual IS DISTINCT FROM TRUE) THEN
    NEW.inicio_ciclo := (now() AT TIME ZONE 'America/Monterrey')::date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ciclos_escolares_marcar_inicio_ciclo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_marcar_inicio_ciclo ON public.ciclos_escolares;
CREATE TRIGGER trigger_marcar_inicio_ciclo
  BEFORE INSERT OR UPDATE OF es_actual ON public.ciclos_escolares
  FOR EACH ROW EXECUTE FUNCTION public.ciclos_escolares_marcar_inicio_ciclo();

-- Ciclo 2026-2027: el cambio de ciclo se hizo el 20 de julio de 2026.
UPDATE public.ciclos_escolares SET inicio_ciclo = DATE '2026-07-20' WHERE valor = 23 AND inicio_ciclo IS NULL;
