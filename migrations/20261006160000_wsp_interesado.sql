-- 2026-10-06 — Familia Winston: el comprobante guarda al interesado (alumno nuevo) y su cita,
-- para que el validador llene solo «¿A quién recomendó?» al leer el QR.
-- AgendaW los llena al generar el comprobante y al agendar la cita; los comprobantes
-- anteriores quedan en NULL (antes solo se guardaba el número de quien recomienda).

ALTER TABLE public.wsp
  ADD COLUMN IF NOT EXISTS interesado_nombre text,
  ADD COLUMN IF NOT EXISTS interesado_nivel_grado text,
  ADD COLUMN IF NOT EXISTS interesado_ciclo text,
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

CREATE INDEX IF NOT EXISTS idx_wsp_appointment_id ON public.wsp (appointment_id);
