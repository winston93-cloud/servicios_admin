-- Inscripción de alumnos a un grupo programado de taller (taller_asignacion).
-- Baja = estado 'baja' (se conserva historial); reinscribir reactiva la misma fila.

CREATE TABLE IF NOT EXISTS public.taller_inscripcion (
  id SERIAL PRIMARY KEY,
  asignacion_id INTEGER NOT NULL REFERENCES public.taller_asignacion(id) ON DELETE RESTRICT,
  alumno_id INTEGER NOT NULL,
  alumno_ref INTEGER,
  ciclo_escolar SMALLINT NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'inscrito' CHECK (estado IN ('inscrito', 'baja')),
  notas TEXT,
  fecha_alta TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_baja TIMESTAMPTZ,
  motivo_baja VARCHAR(200),
  registrado_por VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT taller_inscripcion_unica UNIQUE (asignacion_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS taller_inscripcion_alumno_idx ON public.taller_inscripcion (alumno_id, estado);
CREATE INDEX IF NOT EXISTS taller_inscripcion_asignacion_idx ON public.taller_inscripcion (asignacion_id, estado);
