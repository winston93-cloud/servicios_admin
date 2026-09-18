-- Restaura tablas POS Desayunos en Winston Servicios (proyecto NANO Desayunos → g4ta4bfg).
-- Solo CREATE IF NOT EXISTS: no altera ni borra tablas/datos ya en producción.
-- portal_news_desayunos no se toca (ya vive en Winston).

CREATE TABLE IF NOT EXISTS public.concepto_desayunos (
  id SERIAL PRIMARY KEY,
  desayuno_nombre VARCHAR(100) NOT NULL,
  desayuno_abreviatura VARCHAR(20),
  costo NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.desayunos_saldo (
  id SERIAL PRIMARY KEY,
  saldo_ref VARCHAR(50) NOT NULL,
  saldo_monto NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS desayunos_saldo_ref_uidx
  ON public.desayunos_saldo (saldo_ref);

CREATE TABLE IF NOT EXISTS public.pago_desayunos (
  id BIGSERIAL PRIMARY KEY,
  pago_ref VARCHAR(50) NOT NULL,
  pago_descripcion VARCHAR(200),
  pago_costo NUMERIC(10, 2),
  pago_fecha DATE,
  pago_cantidad INTEGER DEFAULT 1,
  pago_orden VARCHAR(100),
  pago_estatus SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS pago_desayunos_fecha ON public.pago_desayunos (pago_fecha);
CREATE INDEX IF NOT EXISTS pago_desayunos_ref ON public.pago_desayunos (pago_ref);

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id SERIAL PRIMARY KEY,
  referencia INTEGER NOT NULL,
  asunto VARCHAR(200),
  mensaje TEXT,
  estatus SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificaciones_referencia_idx
  ON public.notificaciones (referencia);
CREATE INDEX IF NOT EXISTS notificaciones_estatus_idx
  ON public.notificaciones (estatus);
