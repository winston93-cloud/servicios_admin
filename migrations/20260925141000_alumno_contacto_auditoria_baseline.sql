-- 2026-09-25: Baseline one-shot del historial (estado actual al activar).
-- Ya aplicado en Winston live vía CLI. Idempotente con NOT EXISTS.

INSERT INTO public.alumno_contacto_auditoria (
  actor_tipo, actor_label, accion, entidad, entidad_id, alumno_id, detalle
)
SELECT
  'sistema',
  'baseline',
  'familiar.snapshot',
  'alumno_familiar',
  familiar_id,
  alumno_id,
  jsonb_build_object(
    'origen', 'baseline',
    'after', jsonb_build_object(
      'familiar_id', familiar_id,
      'alumno_id', alumno_id,
      'tutor_id', tutor_id,
      'familiar_nombre', familiar_nombre,
      'familiar_app', familiar_app,
      'familiar_apm', familiar_apm,
      'familiar_email', familiar_email,
      'familiar_recibir_email', familiar_recibir_email,
      'familiar_registro', familiar_registro
    ),
    'tutor_id', tutor_id,
    'nota', 'baseline historial 2026-09-25'
  )
FROM public.alumno_familiar f
WHERE NOT EXISTS (
  SELECT 1 FROM public.alumno_contacto_auditoria a
  WHERE a.entidad = 'alumno_familiar'
    AND a.entidad_id = f.familiar_id
    AND a.accion = 'familiar.snapshot'
);

INSERT INTO public.alumno_contacto_auditoria (
  actor_tipo, actor_label, accion, entidad, entidad_id, alumno_id, detalle
)
SELECT
  'sistema',
  'baseline',
  'contacto.snapshot',
  'alumno_contacto',
  contacto_id,
  alumno_id,
  jsonb_build_object(
    'origen', 'baseline',
    'after', jsonb_build_object(
      'contacto_id', contacto_id,
      'alumno_id', alumno_id,
      'contacto_tipo', contacto_tipo,
      'contacto_nombre', contacto_nombre,
      'tutor_clase', tutor_clase,
      'contacto_tel', contacto_tel,
      'contacto_cel', contacto_cel,
      'contacto_alta', contacto_alta
    ),
    'contacto_tipo', contacto_tipo,
    'parentesco', tutor_clase,
    'nota', 'baseline historial 2026-09-25'
  )
FROM public.alumno_contacto c
WHERE NOT EXISTS (
  SELECT 1 FROM public.alumno_contacto_auditoria a
  WHERE a.entidad = 'alumno_contacto'
    AND a.entidad_id = c.contacto_id
    AND a.accion = 'contacto.snapshot'
);
