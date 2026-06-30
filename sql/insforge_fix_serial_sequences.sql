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

-- Tablas alumno (migración MySQL con ids explícitos)
SELECT setval(
  pg_get_serial_sequence('public.alumno', 'alumno_id'),
  GREATEST((SELECT COALESCE(MAX(alumno_id), 0) FROM public.alumno), 1),
  (SELECT COALESCE(MAX(alumno_id), 0) > 0 FROM public.alumno)
);

SELECT setval(
  pg_get_serial_sequence('public.alumno_detalles', 'detalle_id'),
  GREATEST((SELECT COALESCE(MAX(detalle_id), 0) FROM public.alumno_detalles), 1),
  (SELECT COALESCE(MAX(detalle_id), 0) > 0 FROM public.alumno_detalles)
);

SELECT setval(
  pg_get_serial_sequence('public.alumno_familiar', 'familiar_id'),
  GREATEST((SELECT COALESCE(MAX(familiar_id), 0) FROM public.alumno_familiar), 1),
  (SELECT COALESCE(MAX(familiar_id), 0) > 0 FROM public.alumno_familiar)
);

SELECT setval(
  pg_get_serial_sequence('public.alumno_contacto', 'contacto_id'),
  GREATEST((SELECT COALESCE(MAX(contacto_id), 0) FROM public.alumno_contacto), 1),
  (SELECT COALESCE(MAX(contacto_id), 0) > 0 FROM public.alumno_contacto)
);

SELECT setval(
  pg_get_serial_sequence('public.alumno_beca', 'alumno_beca_id'),
  GREATEST((SELECT COALESCE(MAX(alumno_beca_id), 0) FROM public.alumno_beca), 1),
  (SELECT COALESCE(MAX(alumno_beca_id), 0) > 0 FROM public.alumno_beca)
);
