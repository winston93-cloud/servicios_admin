-- Recordatorio 24h a control escolar si hay docs NI sin liberar (a_inscritos).

ALTER TABLE public.portal_documentos_ni
  ADD COLUMN IF NOT EXISTS recordatorio_liberacion_at timestamptz;

CREATE INDEX IF NOT EXISTS portal_documentos_ni_recordatorio_idx
  ON public.portal_documentos_ni (recordatorio_liberacion_at);
