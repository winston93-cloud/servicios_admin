-- Etapa 3/4 devoluciones: vínculo con cheque Winston/Educativo
ALTER TABLE public.devolucion_tarjeta
  ADD COLUMN IF NOT EXISTS cheque_numero INTEGER,
  ADD COLUMN IF NOT EXISTS cheque_entidad VARCHAR(32),
  ADD COLUMN IF NOT EXISTS cheque_firma_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS etapa3_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS etapa3_por VARCHAR(160),
  ADD COLUMN IF NOT EXISTS etapa4_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS etapa4_por VARCHAR(160);

ALTER TABLE public.ch_cheques
  ADD COLUMN IF NOT EXISTS folio_devolucion INTEGER;

ALTER TABLE public.ch_cheques_ed
  ADD COLUMN IF NOT EXISTS folio_devolucion INTEGER;
