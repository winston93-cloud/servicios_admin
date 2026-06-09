-- Reparar secuencias SERIAL/BIGSERIAL tras migrar filas con id explícito (Supabase → InsForge).
-- Ejecutar una vez en InsForge → SQL (Winston Servicios).
-- Tabla vacía: setval(1, false) para que el próximo id sea 1 (0 no es válido en secuencias).
-- Tabla con filas: setval(max_id, true) para que el próximo id sea max_id + 1.
--
-- Diagnóstico openpay_webhook_log (pg_sequences en InsForge NO tiene is_called):
--   SELECT MAX(id) AS max_id FROM public.openpay_webhook_log;
--   SELECT sequencename, last_value FROM pg_sequences
--     WHERE schemaname = 'public' AND sequencename LIKE 'openpay_webhook_log%';

SELECT setval(
  pg_get_serial_sequence('public.openpay_webhook_log', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.openpay_webhook_log), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.openpay_webhook_log)
);

SELECT setval(
  pg_get_serial_sequence('public.openpay_webhook_verificacion', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.openpay_webhook_verificacion), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.openpay_webhook_verificacion)
);

SELECT setval(
  pg_get_serial_sequence('public.banorte_payw_intento', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.banorte_payw_intento), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.banorte_payw_intento)
);

SELECT setval(
  pg_get_serial_sequence('public.registro_salida_pie', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.registro_salida_pie), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.registro_salida_pie)
);

SELECT setval(
  pg_get_serial_sequence('public.ciclos_escolares', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.ciclos_escolares), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.ciclos_escolares)
);

SELECT setval(
  pg_get_serial_sequence('public.concepto_desayunos', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.concepto_desayunos), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.concepto_desayunos)
);

SELECT setval(
  pg_get_serial_sequence('public.personal', 'id'),
  GREATEST((SELECT COALESCE(MAX(id), 0) FROM public.personal), 1),
  (SELECT COALESCE(MAX(id), 0) > 0 FROM public.personal)
);
