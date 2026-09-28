-- Talleres y Clases Especiales: catálogo de talleres, maestros de taller,
-- asignaciones por ciclo escolar y horario semanal (lunes a sábado).
-- niveles: 1 maternal, 2 kinder, 3 primaria, 4 secundaria.

CREATE TABLE IF NOT EXISTS public.taller (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  grados VARCHAR(60),
  descripcion TEXT,
  niveles SMALLINT[] NOT NULL DEFAULT '{}',
  color VARCHAR(9),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taller_nombre_grados
  ON public.taller (LOWER(nombre), LOWER(COALESCE(grados, '')));

CREATE TABLE IF NOT EXISTS public.taller_maestro (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellido_paterno VARCHAR(80),
  apellido_materno VARCHAR(80),
  email VARCHAR(160),
  celular VARCHAR(30),
  especialidad VARCHAR(120),
  niveles SMALLINT[] NOT NULL DEFAULT '{}',
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.taller_asignacion (
  id SERIAL PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES public.taller (id) ON DELETE RESTRICT,
  maestro_id INTEGER NOT NULL REFERENCES public.taller_maestro (id) ON DELETE RESTRICT,
  ciclo_escolar SMALLINT NOT NULL,
  niveles SMALLINT[] NOT NULL DEFAULT '{}',
  lugar VARCHAR(80),
  cupo INTEGER CHECK (cupo IS NULL OR cupo > 0),
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taller_asignacion_ciclo
  ON public.taller_asignacion (ciclo_escolar, activo);

CREATE TABLE IF NOT EXISTS public.taller_horario (
  id SERIAL PRIMARY KEY,
  asignacion_id INTEGER NOT NULL REFERENCES public.taller_asignacion (id) ON DELETE CASCADE,
  dia SMALLINT NOT NULL CHECK (dia BETWEEN 1 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_taller_horario_asignacion
  ON public.taller_horario (asignacion_id);
