-- Winston USA Program: monto por pago (conceptos 23 / 24 / 25).
-- precio_dtitulacion queda como total (suma de los tres). Filas con los tres en 0 y total > 0
-- (ciclos anteriores) siguen cobrando un tercio del total por pago.

ALTER TABLE public.pago_boucher_precio
  ADD COLUMN IF NOT EXISTS precio_usa1 numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_usa2 numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_usa3 numeric(10, 2) NOT NULL DEFAULT 0;
