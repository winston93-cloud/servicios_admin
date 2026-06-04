-- Reparar secuencias SERIAL/BIGSERIAL tras migrar filas con id explícito (Supabase → InsForge).
-- Ejecutar una vez en InsForge → SQL (Winston Servicios).
-- Si nextval sigue fallando, sustituye el nombre de secuencia por el que muestre \d tabla en psql.

SELECT setval(
  pg_get_serial_sequence('public.openpay_webhook_log', 'id'),
  COALESCE((SELECT MAX(id) FROM public.openpay_webhook_log), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.openpay_webhook_verificacion', 'id'),
  COALESCE((SELECT MAX(id) FROM public.openpay_webhook_verificacion), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.banorte_payw_intento', 'id'),
  COALESCE((SELECT MAX(id) FROM public.banorte_payw_intento), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.registro_salida_pie', 'id'),
  COALESCE((SELECT MAX(id) FROM public.registro_salida_pie), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.ciclos_escolares', 'id'),
  COALESCE((SELECT MAX(id) FROM public.ciclos_escolares), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.concepto_desayunos', 'id'),
  COALESCE((SELECT MAX(id) FROM public.concepto_desayunos), 0),
  true
);

SELECT setval(
  pg_get_serial_sequence('public.personal', 'id'),
  COALESCE((SELECT MAX(id) FROM public.personal), 0),
  true
);
