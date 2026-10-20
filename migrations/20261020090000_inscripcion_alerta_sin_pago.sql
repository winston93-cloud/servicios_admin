-- Control escolar: alumnos que ya se avisaron por llevar más de 30 días con referencia sin pagar inscripción.
-- Fila presente = aviso abierto (correo + notificación ya enviados). Se borra cuando el alumno paga, se da de baja
-- o deja de cumplir la regla. La PK evita avisos duplicados entre peticiones simultáneas.

CREATE TABLE IF NOT EXISTS public.inscripcion_alerta_sin_pago (
  alumno_id integer PRIMARY KEY,
  ciclo_escolar smallint NOT NULL,
  alumno_nivel smallint NOT NULL,
  alertado_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inscripcion_alerta_sin_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripcion_alerta_sin_pago FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.inscripcion_alerta_sin_pago;
CREATE POLICY servicios_insforge_deny_anon ON public.inscripcion_alerta_sin_pago
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.inscripcion_alerta_sin_pago FROM anon, authenticated;
