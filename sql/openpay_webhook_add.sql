-- OpenPay webhooks (portal de pagos — verificación y auditoría)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.openpay_webhook_verificacion (
  id BIGSERIAL PRIMARY KEY,
  cuenta VARCHAR(20) NOT NULL,
  verification_code VARCHAR(64) NOT NULL,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS openpay_webhook_verificacion_cuenta_fecha
  ON public.openpay_webhook_verificacion (cuenta, recibido_en DESC);

COMMENT ON TABLE public.openpay_webhook_verificacion IS
  'Códigos de verificación de webhook OpenPay (evento verification).';

CREATE TABLE IF NOT EXISTS public.openpay_webhook_log (
  id BIGSERIAL PRIMARY KEY,
  cuenta VARCHAR(20) NOT NULL,
  tipo_evento VARCHAR(64) NOT NULL,
  referencia VARCHAR(20),
  transaction_id VARCHAR(80),
  ok BOOLEAN NOT NULL DEFAULT true,
  mensaje TEXT,
  payload JSONB,
  recibido_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS openpay_webhook_log_cuenta_fecha
  ON public.openpay_webhook_log (cuenta, recibido_en DESC);

COMMENT ON TABLE public.openpay_webhook_log IS
  'Auditoría de eventos OpenPay (reemplaza webhook.log / webhook_error.log legacy).';
