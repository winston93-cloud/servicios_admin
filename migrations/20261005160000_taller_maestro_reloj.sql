-- 2026-10-05 — Talleres ↔ reloj checador: cada maestro de taller se liga a su número de
-- empleado en el reloj (rn_employees.employee_number) y al campus del reloj donde está dado de alta.
ALTER TABLE public.taller_maestro
  ADD COLUMN IF NOT EXISTS numero_empleado text,
  ADD COLUMN IF NOT EXISTS institucion_reloj text;

ALTER TABLE public.taller_maestro
  DROP CONSTRAINT IF EXISTS taller_maestro_institucion_reloj_chk;
ALTER TABLE public.taller_maestro
  ADD CONSTRAINT taller_maestro_institucion_reloj_chk
  CHECK (institucion_reloj IS NULL OR institucion_reloj IN ('educativo', 'kinder'));

ALTER TABLE public.taller_maestro
  DROP CONSTRAINT IF EXISTS taller_maestro_numero_empleado_chk;
ALTER TABLE public.taller_maestro
  ADD CONSTRAINT taller_maestro_numero_empleado_chk
  CHECK (numero_empleado IS NULL OR numero_empleado ~ '^[0-9]{1,12}$');

COMMENT ON COLUMN public.taller_maestro.numero_empleado IS
  'Número de empleado en el reloj checador; sin él sus clases no pasan a la prenómina del reloj.';
COMMENT ON COLUMN public.taller_maestro.institucion_reloj IS
  'Campus del reloj: educativo = WINSTON, kinder = EDUCATIVO.';
