-- Proyecto InsForge «boletas» — schema completo (paridad legacy winston_general / carpeta boletas)
-- Aplicar en el proyecto boletas (NO en Winston Servicios).

-- Alumnos (copia operativa para el módulo)
CREATE TABLE IF NOT EXISTS public.alumno (
  alumno_id INTEGER PRIMARY KEY,
  alumno_ref INTEGER NULL,
  alumno_app VARCHAR(50) NULL,
  alumno_apm VARCHAR(50) NULL,
  alumno_nombre VARCHAR(50) NULL,
  alumno_nivel SMALLINT NULL,
  alumno_grado SMALLINT NULL,
  alumno_grupo SMALLINT NULL,
  alumno_status SMALLINT NOT NULL DEFAULT 1,
  alumno_nuevo_ingreso SMALLINT NOT NULL DEFAULT 0,
  alumno_ciclo_escolar SMALLINT NULL,
  alumno_registro DATE NULL,
  alumno_alta DATE NULL,
  alumno_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alumno_boleta SMALLINT NOT NULL DEFAULT 0,
  mes SMALLINT NOT NULL DEFAULT 0,
  secret_key VARCHAR(64) NOT NULL DEFAULT '',
  motivo VARCHAR(200) NOT NULL DEFAULT '',
  responsable VARCHAR(50) NOT NULL DEFAULT '',
  estatus_key SMALLINT NOT NULL DEFAULT 0,
  digito INTEGER NOT NULL DEFAULT 0,
  hijo SMALLINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS alumno_ref_uidx ON public.alumno (alumno_ref);
CREATE INDEX IF NOT EXISTS alumno_nivel_grado_idx ON public.alumno (alumno_nivel, alumno_grado, alumno_grupo);
CREATE INDEX IF NOT EXISTS alumno_ciclo_idx ON public.alumno (alumno_ciclo_escolar);

CREATE TABLE IF NOT EXISTS public.alumno_detalles (
  detalle_id INTEGER PRIMARY KEY,
  alumno_id INTEGER NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  alumno_clave VARCHAR(20) NULL,
  alumno_fecha_nac DATE NULL,
  alumno_lugar_nac VARCHAR(50) NULL,
  alumno_curp VARCHAR(18) NULL,
  alumno_sexo CHAR(1) NULL,
  alumno_calle VARCHAR(100) NULL,
  alumno_numero VARCHAR(50) NULL,
  alumno_numeroint VARCHAR(50) NULL,
  alumno_colonia VARCHAR(100) NULL,
  alumno_cp INTEGER NULL,
  alumno_entre_calles VARCHAR(150) NULL,
  estado_id VARCHAR(200) NULL,
  cuidad_id VARCHAR(200) NULL,
  alumno_escuela_procedente VARCHAR(50) NULL,
  tipo_relacion INTEGER NULL,
  comentario_relacion VARCHAR(100) NULL,
  detalle_registro TIMESTAMP NULL,
  detalle_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS alumno_detalles_alumno_uidx ON public.alumno_detalles (alumno_id);

CREATE TABLE IF NOT EXISTS public.alumno_familiar (
  familiar_id INTEGER PRIMARY KEY,
  alumno_id INTEGER NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  tutor_id SMALLINT NULL,
  familiar_app VARCHAR(50) NULL,
  familiar_apm VARCHAR(50) NULL,
  familiar_nombre VARCHAR(50) NULL,
  familiar_tel VARCHAR(20) NULL,
  familiar_cel VARCHAR(20) NULL,
  familiar_email VARCHAR(100) NULL,
  familiar_recibir_email SMALLINT NOT NULL DEFAULT 0,
  familiar_fecha_nac DATE NULL,
  familiar_lugar_nac VARCHAR(50) NULL,
  familiar_curp VARCHAR(18) NULL,
  familiar_escolaridad VARCHAR(50) NULL,
  familiar_empresa_nombre VARCHAR(100) NULL,
  familiar_empresa_direccion VARCHAR(200) NULL,
  familiar_empresa_puesto VARCHAR(100) NULL
);
CREATE INDEX IF NOT EXISTS alumno_familiar_alumno_idx ON public.alumno_familiar (alumno_id);

-- Admin legacy del sistema de boletas
CREATE TABLE IF NOT EXISTS public.usuario (
  usuario_id SMALLINT PRIMARY KEY,
  perfil_id SMALLINT,
  usuario_app VARCHAR(50),
  usuario_apm VARCHAR(50),
  usuario_nombre VARCHAR(50),
  usuario_username VARCHAR(40) NOT NULL,
  usuario_email VARCHAR(100),
  usuario_password VARCHAR(255) NOT NULL,
  usuario_status SMALLINT DEFAULT 1,
  usuario_alta TIMESTAMP,
  nivel INTEGER DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS usuario_username_uidx ON public.usuario (usuario_username);

-- Catálogo boletas
CREATE TABLE IF NOT EXISTS public.boleta_materia (
  materia_id INTEGER PRIMARY KEY,
  materia_nombre VARCHAR(120) NOT NULL,
  materia_nivel SMALLINT NOT NULL,
  materia_grado SMALLINT NOT NULL,
  materia_orden SMALLINT NOT NULL DEFAULT 0,
  materia_registro DATE
);
CREATE INDEX IF NOT EXISTS boleta_materia_nivel ON public.boleta_materia (materia_nivel, materia_grado);

CREATE TABLE IF NOT EXISTS public.boleta_maestro (
  maestro_id INTEGER PRIMARY KEY,
  maestro_app VARCHAR(80),
  maestro_apm VARCHAR(80),
  maestro_nombre VARCHAR(80),
  maestro_usuario VARCHAR(40),
  maestro_clave VARCHAR(80),
  maestro_sexo SMALLINT NOT NULL DEFAULT 0,
  maestro_celular VARCHAR(20),
  maestro_registro DATE,
  maestro_email VARCHAR(120)
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_maestro_usuario_uidx ON public.boleta_maestro (maestro_usuario);

CREATE TABLE IF NOT EXISTS public.boleta_maestro_grupo (
  grupo_id INTEGER PRIMARY KEY,
  maestro_id INTEGER NOT NULL REFERENCES public.boleta_maestro (maestro_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  grupo_letra VARCHAR(10),
  grupo_registro DATE
);
CREATE INDEX IF NOT EXISTS boleta_maestro_grupo_maestro ON public.boleta_maestro_grupo (maestro_id);
CREATE INDEX IF NOT EXISTS boleta_maestro_grupo_materia ON public.boleta_maestro_grupo (materia_id);

CREATE TABLE IF NOT EXISTS public.boleta_bimestre (
  bimestre_id INTEGER PRIMARY KEY,
  bimestre_activo SMALLINT NOT NULL DEFAULT 1,
  bimestre_etiqueta VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS public.boleta_calificacion (
  calificacion_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  calificacion_bimestre SMALLINT NOT NULL,
  calificacion_ciclo_escolar SMALLINT NOT NULL,
  calificacion_puntos VARCHAR(20),
  calificacion_registro TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_calif_unique
  ON public.boleta_calificacion (alumno_id, materia_id, calificacion_bimestre, calificacion_ciclo_escolar);
CREATE INDEX IF NOT EXISTS boleta_calif_ciclo_idx
  ON public.boleta_calificacion (calificacion_ciclo_escolar, calificacion_bimestre);

CREATE TABLE IF NOT EXISTS public.boleta_inasistencia (
  inasistencia_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  inasistencia_bimestre SMALLINT NOT NULL,
  inasistencia_ciclo_escolar SMALLINT NOT NULL,
  inasistencia_cantidad SMALLINT NOT NULL DEFAULT 0,
  inasistencia_registro TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_inasistencia_unique
  ON public.boleta_inasistencia (alumno_id, materia_id, inasistencia_bimestre, inasistencia_ciclo_escolar);

CREATE TABLE IF NOT EXISTS public.boleta_conducta (
  conducta_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  conducta_bimestre SMALLINT NOT NULL,
  conducta_ciclo_escolar SMALLINT NOT NULL,
  conducta_valor VARCHAR(20),
  conducta_registro TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_conducta_unique
  ON public.boleta_conducta (alumno_id, materia_id, conducta_bimestre, conducta_ciclo_escolar);

CREATE TABLE IF NOT EXISTS public.boleta_comprension_lectora (
  comprension_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  comprension_trimestre SMALLINT NOT NULL,
  comprension_ciclo_escolar SMALLINT NOT NULL,
  comprension_valor VARCHAR(20),
  comprension_registro TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_comprension_unique
  ON public.boleta_comprension_lectora (alumno_id, comprension_trimestre, comprension_ciclo_escolar);

CREATE TABLE IF NOT EXISTS public.boleta_recuperacion (
  recuperacion_id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alumno_id INTEGER NOT NULL REFERENCES public.alumno (alumno_id) ON DELETE CASCADE,
  materia_id INTEGER NOT NULL REFERENCES public.boleta_materia (materia_id) ON DELETE CASCADE,
  recuperacion_ciclo_escolar SMALLINT NOT NULL,
  recuperacion_puntos VARCHAR(20),
  recuperacion_registro TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS boleta_recuperacion_unique
  ON public.boleta_recuperacion (alumno_id, materia_id, recuperacion_ciclo_escolar);

-- RLS deny-anon (API solo con service key)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alumno','alumno_detalles','alumno_familiar','usuario',
    'boleta_materia','boleta_maestro','boleta_maestro_grupo','boleta_bimestre',
    'boleta_calificacion','boleta_inasistencia','boleta_conducta',
    'boleta_comprension_lectora','boleta_recuperacion'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS boletas_deny_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY boletas_deny_anon ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Semilla bimestre activo
INSERT INTO public.boleta_bimestre (bimestre_id, bimestre_activo, bimestre_etiqueta)
VALUES (1, 1, 'Periodo activo')
ON CONFLICT (bimestre_id) DO NOTHING;
