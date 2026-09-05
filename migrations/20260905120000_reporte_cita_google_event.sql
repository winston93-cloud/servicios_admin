-- Citas RAC: id de evento Google Calendar (psicología secundaria / AgendaW).
ALTER TABLE public.reporte_cita
  ADD COLUMN IF NOT EXISTS cita_google_event_id TEXT NULL;
