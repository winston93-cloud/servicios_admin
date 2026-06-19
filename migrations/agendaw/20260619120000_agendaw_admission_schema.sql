-- =============================================================================
-- AgendaW — esquema de admisión en InsForge (proyecto AgendaW)
-- Ejecutar tras enlazar el CLI al proyecto AgendaW:
--   insforge link --project-id <AGENDAW_PROJECT_ID> --org-id 3ffddf5b-9cf9-4a73-8d60-3de260c20676
--   insforge db import migrations/agendaw/20260619120000_agendaw_admission_schema.sql
--   insforge db import migrations/agendaw/20260619120100_agendaw_rls_server_only.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Citas de examen de admisión
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus TEXT NOT NULL CHECK (campus IN ('winston', 'churchill')),
  level TEXT NOT NULL CHECK (level IN ('maternal', 'kinder', 'primaria', 'secundaria')),
  grade_level TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_age TEXT NOT NULL,
  student_last_name_p TEXT,
  student_last_name_m TEXT,
  student_birth_date DATE,
  school_cycle TEXT,
  how_did_you_hear TEXT,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  relationship TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
  notes TEXT,
  origin TEXT NOT NULL DEFAULT 'new',
  legacy_id INT,
  google_event_id TEXT,
  google_event_id_control_escolar TEXT,
  google_event_id_ingles TEXT,
  alumno_ref INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admission_appointments_legacy_id
  ON public.admission_appointments(legacy_id)
  WHERE legacy_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admission_appointments_date
  ON public.admission_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_admission_appointments_status
  ON public.admission_appointments(status);
CREATE INDEX IF NOT EXISTS idx_admission_appointments_level
  ON public.admission_appointments(level);

-- -----------------------------------------------------------------------------
-- Bloqueos de fechas / horarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date DATE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('maternal_kinder', 'primaria', 'secundaria')),
  reason TEXT,
  block_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_full_day
  ON public.blocked_dates (block_date, level)
  WHERE block_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_by_slot
  ON public.blocked_dates (block_date, level, block_time)
  WHERE block_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blocked_dates_date_level
  ON public.blocked_dates(block_date, level);

-- -----------------------------------------------------------------------------
-- Horarios por nivel
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('maternal_kinder', 'primaria', 'secundaria')),
  time_slot TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_admission_schedules_level
  ON public.admission_schedules(level);

-- -----------------------------------------------------------------------------
-- Solicitudes de autorización (directoras)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admission_permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('reagendar', 'horario', 'bloqueo')),
  level TEXT NOT NULL CHECK (level IN ('maternal_kinder', 'primaria', 'secundaria')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  appointment_id UUID REFERENCES public.admission_appointments(id) ON DELETE SET NULL,
  student_name TEXT,
  appt_date TEXT,
  appt_time TEXT,
  proposed_date TEXT,
  proposed_time TEXT,
  proposed_grade TEXT,
  horario_action TEXT CHECK (horario_action IN ('agregar', 'eliminar')),
  horario_time_new TEXT,
  horario_time_old TEXT,
  bloqueo_date TEXT,
  bloqueo_date_end TEXT,
  bloqueo_time TEXT,
  bloqueo_reason TEXT,
  psych_message TEXT,
  director_notes TEXT,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adm_perm_req_level
  ON public.admission_permission_requests(level);
CREATE INDEX IF NOT EXISTS idx_adm_perm_req_status
  ON public.admission_permission_requests(status);
CREATE INDEX IF NOT EXISTS idx_adm_perm_req_created
  ON public.admission_permission_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adm_perm_req_appt_id
  ON public.admission_permission_requests(appointment_id);

-- -----------------------------------------------------------------------------
-- Expediente inicial (admin + futuro enlace papás)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expediente_inicial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.admission_appointments(id) ON DELETE SET NULL,
  nivel TEXT,
  grado TEXT,
  ciclo_escolar TEXT,
  nombre_alumno TEXT,
  apellido_paterno_alumno TEXT,
  apellido_materno_alumno TEXT,
  fecha_nacimiento DATE,
  lugar_nacimiento TEXT,
  sexo TEXT CHECK (sexo IS NULL OR sexo IN ('Masculino', 'Femenino')),
  edad INTEGER,
  escuela_procedencia TEXT,
  padre_nombre TEXT,
  padre_apellido_paterno TEXT,
  padre_apellido_materno TEXT,
  padre_edad INTEGER,
  padre_email TEXT,
  padre_lugar_trabajo TEXT,
  padre_estado_civil TEXT,
  padre_telefono_trabajo TEXT,
  padre_telefono_celular TEXT,
  madre_nombre TEXT,
  madre_apellido_paterno TEXT,
  madre_apellido_materno TEXT,
  madre_edad INTEGER,
  madre_email TEXT,
  madre_lugar_trabajo TEXT,
  madre_estado_civil TEXT,
  madre_telefono_trabajo TEXT,
  madre_telefono_celular TEXT,
  tratamiento_medico_ultimo_ano TEXT,
  tratamiento_psicologico_si BOOLEAN,
  tratamiento_psicologico_razon TEXT,
  clase_extracurricular TEXT,
  nombre_escuela_guarderia TEXT,
  motivo_separacion TEXT,
  motivo_incorporacion TEXT,
  preocupacion_desenvolvimiento TEXT,
  nombre_persona_info TEXT,
  relacion_alumno TEXT,
  conductas JSONB DEFAULT '[]',
  conductas_proceso_control TEXT,
  padre_trabaja_fuera_ciudad BOOLEAN,
  madre_trabaja_fuera_ciudad BOOLEAN,
  alergias_padecimientos TEXT,
  diagnosticos_medicos TEXT,
  num_familiares_adicionales INTEGER,
  lugar_ocupa_aspirante INTEGER,
  edades_familiares TEXT,
  familiar_1_nombre TEXT,
  familiar_1_apellidos TEXT,
  familiar_1_edad INTEGER,
  familiar_2_nombre TEXT,
  familiar_2_apellidos TEXT,
  familiar_2_edad INTEGER,
  familiar_3_nombre TEXT,
  familiar_3_apellidos TEXT,
  familiar_3_edad INTEGER,
  familiar_4_nombre TEXT,
  familiar_4_apellidos TEXT,
  familiar_4_edad INTEGER,
  telefono_principal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expediente_inicial_appointment
  ON public.expediente_inicial(appointment_id);

-- -----------------------------------------------------------------------------
-- Recorridos (vinculación)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tour_recorridos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('maternal', 'kinder', 'primaria', 'secundaria')),
  tour_date DATE NOT NULL,
  tour_time TEXT NOT NULL CHECK (tour_time ~ '^[0-9]{1,2}:[0-9]{2}$'),
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  student_name TEXT,
  notes TEXT,
  email_parent_sent BOOLEAN DEFAULT false,
  email_director_sent BOOLEAN DEFAULT false,
  slack_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  google_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_recorridos_date ON public.tour_recorridos(tour_date);
CREATE INDEX IF NOT EXISTS idx_tour_recorridos_level ON public.tour_recorridos(level);
CREATE INDEX IF NOT EXISTS idx_tour_recorridos_created ON public.tour_recorridos(created_at DESC);

-- -----------------------------------------------------------------------------
-- Familia Winston (futuro enlace flujo papás)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wsp (
  id BIGSERIAL PRIMARY KEY,
  ctrl INTEGER NOT NULL,
  qr INTEGER NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'INICIAL',
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wsp_ctrl ON public.wsp (ctrl);
CREATE INDEX IF NOT EXISTS idx_wsp_qr ON public.wsp (qr);

-- -----------------------------------------------------------------------------
-- Triggers updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agendaw_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admission_appointments_updated_at ON public.admission_appointments;
CREATE TRIGGER trg_admission_appointments_updated_at
  BEFORE UPDATE ON public.admission_appointments
  FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();

DROP TRIGGER IF EXISTS trg_expediente_inicial_updated_at ON public.expediente_inicial;
CREATE TRIGGER trg_expediente_inicial_updated_at
  BEFORE UPDATE ON public.expediente_inicial
  FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();

DROP TRIGGER IF EXISTS trg_tour_recorridos_updated_at ON public.tour_recorridos;
CREATE TRIGGER trg_tour_recorridos_updated_at
  BEFORE UPDATE ON public.tour_recorridos
  FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();
