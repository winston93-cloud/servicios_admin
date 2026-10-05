-- AgendaW (InsForge sr6a9iza) → Winston Servicios (g4ta4bfg).
-- Esquema idéntico al de AgendaW salvo `wsp`, que en Winston ya existe con otro uso:
-- aquí se llama `agendaw_wsp` (con su propia secuencia e índices).
-- Acceso solo desde servidor (API key); anon/authenticated denegados por RLS.
-- La API de InsForge rechaza BEGIN/COMMIT explícitos: enviar el archivo completo
-- en una sola consulta (`db query -- "$(cat …)"`), que Postgres ejecuta como una transacción.

CREATE OR REPLACE FUNCTION public.agendaw_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE TABLE public.admission_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus text NOT NULL,
  level text NOT NULL,
  grade_level text NOT NULL,
  student_name text NOT NULL,
  student_age text NOT NULL,
  student_last_name_p text,
  student_last_name_m text,
  student_birth_date date,
  school_cycle text,
  how_did_you_hear text,
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text NOT NULL,
  relationship text NOT NULL,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  notes text,
  origin text NOT NULL DEFAULT 'new'::text,
  legacy_id integer,
  google_event_id text,
  google_event_id_control_escolar text,
  google_event_id_ingles text,
  alumno_ref integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  google_event_id_psic_educativo text,
  google_event_id_psic_primaria text,
  google_event_id_psic_secundaria text,
  CONSTRAINT admission_appointments_pkey PRIMARY KEY (id),
  CONSTRAINT admission_appointments_level_check CHECK (level = ANY (ARRAY['maternal'::text, 'kinder'::text, 'primaria'::text, 'secundaria'::text])),
  CONSTRAINT admission_appointments_campus_check CHECK (campus = ANY (ARRAY['winston'::text, 'churchill'::text])),
  CONSTRAINT admission_appointments_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]))
);
CREATE INDEX idx_admission_appointments_date ON public.admission_appointments USING btree (appointment_date);
CREATE UNIQUE INDEX idx_admission_appointments_legacy_id ON public.admission_appointments USING btree (legacy_id) WHERE (legacy_id IS NOT NULL);
CREATE INDEX idx_admission_appointments_level ON public.admission_appointments USING btree (level);
CREATE INDEX idx_admission_appointments_status ON public.admission_appointments USING btree (status);
CREATE TRIGGER trg_admission_appointments_updated_at BEFORE UPDATE ON public.admission_appointments FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();

CREATE TABLE public.admission_permission_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  level text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente'::text,
  appointment_id uuid,
  student_name text,
  appt_date text,
  appt_time text,
  proposed_date text,
  proposed_time text,
  proposed_grade text,
  horario_action text,
  horario_time_new text,
  horario_time_old text,
  bloqueo_date text,
  bloqueo_date_end text,
  bloqueo_time text,
  bloqueo_reason text,
  psych_message text,
  director_notes text,
  requested_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT admission_permission_requests_pkey PRIMARY KEY (id),
  CONSTRAINT admission_permission_requests_type_check CHECK (type = ANY (ARRAY['reagendar'::text, 'horario'::text, 'bloqueo'::text])),
  CONSTRAINT admission_permission_requests_horario_action_check CHECK (horario_action = ANY (ARRAY['agregar'::text, 'eliminar'::text])),
  CONSTRAINT admission_permission_requests_level_check CHECK (level = ANY (ARRAY['maternal_kinder'::text, 'primaria'::text, 'secundaria'::text])),
  CONSTRAINT admission_permission_requests_status_check CHECK (status = ANY (ARRAY['pendiente'::text, 'aprobada'::text, 'rechazada'::text])),
  CONSTRAINT admission_permission_requests_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.admission_appointments (id) ON DELETE SET NULL
);
CREATE INDEX idx_adm_perm_req_appt_id ON public.admission_permission_requests USING btree (appointment_id);
CREATE INDEX idx_adm_perm_req_created ON public.admission_permission_requests USING btree (created_at DESC);
CREATE INDEX idx_adm_perm_req_level ON public.admission_permission_requests USING btree (level);
CREATE INDEX idx_adm_perm_req_status ON public.admission_permission_requests USING btree (status);

CREATE TABLE public.expediente_inicial (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  appointment_id uuid,
  nivel text,
  grado text,
  ciclo_escolar text,
  nombre_alumno text,
  apellido_paterno_alumno text,
  apellido_materno_alumno text,
  fecha_nacimiento date,
  lugar_nacimiento text,
  sexo text,
  edad integer,
  escuela_procedencia text,
  padre_nombre text,
  padre_apellido_paterno text,
  padre_apellido_materno text,
  padre_edad integer,
  padre_email text,
  padre_lugar_trabajo text,
  padre_estado_civil text,
  padre_telefono_trabajo text,
  padre_telefono_celular text,
  madre_nombre text,
  madre_apellido_paterno text,
  madre_apellido_materno text,
  madre_edad integer,
  madre_email text,
  madre_lugar_trabajo text,
  madre_estado_civil text,
  madre_telefono_trabajo text,
  madre_telefono_celular text,
  tratamiento_medico_ultimo_ano text,
  tratamiento_psicologico_si boolean,
  tratamiento_psicologico_razon text,
  clase_extracurricular text,
  nombre_escuela_guarderia text,
  motivo_separacion text,
  motivo_incorporacion text,
  preocupacion_desenvolvimiento text,
  nombre_persona_info text,
  relacion_alumno text,
  conductas jsonb DEFAULT '[]'::jsonb,
  conductas_proceso_control text,
  padre_trabaja_fuera_ciudad boolean,
  madre_trabaja_fuera_ciudad boolean,
  alergias_padecimientos text,
  diagnosticos_medicos text,
  num_familiares_adicionales integer,
  lugar_ocupa_aspirante integer,
  edades_familiares text,
  familiar_1_nombre text,
  familiar_1_apellidos text,
  familiar_1_edad integer,
  familiar_2_nombre text,
  familiar_2_apellidos text,
  familiar_2_edad integer,
  familiar_3_nombre text,
  familiar_3_apellidos text,
  familiar_3_edad integer,
  familiar_4_nombre text,
  familiar_4_apellidos text,
  familiar_4_edad integer,
  telefono_principal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expediente_inicial_pkey PRIMARY KEY (id),
  CONSTRAINT expediente_inicial_sexo_check CHECK ((sexo IS NULL) OR (sexo = ANY (ARRAY['Masculino'::text, 'Femenino'::text]))),
  CONSTRAINT expediente_inicial_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.admission_appointments (id) ON DELETE SET NULL
);
CREATE INDEX idx_expediente_inicial_appointment ON public.expediente_inicial USING btree (appointment_id);
CREATE TRIGGER trg_expediente_inicial_updated_at BEFORE UPDATE ON public.expediente_inicial FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();

CREATE SEQUENCE public.agendaw_wsp_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE TABLE public.agendaw_wsp (
  id bigint NOT NULL DEFAULT nextval('public.agendaw_wsp_id_seq'::regclass),
  ctrl integer NOT NULL,
  qr integer NOT NULL,
  estatus text NOT NULL DEFAULT 'INICIAL'::text,
  status text NOT NULL DEFAULT 'pendiente'::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agendaw_wsp_pkey PRIMARY KEY (id)
);
ALTER SEQUENCE public.agendaw_wsp_id_seq OWNED BY public.agendaw_wsp.id;
CREATE INDEX idx_agendaw_wsp_ctrl ON public.agendaw_wsp USING btree (ctrl);
CREATE INDEX idx_agendaw_wsp_qr ON public.agendaw_wsp USING btree (qr);

CREATE TABLE public.tour_recorridos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  tour_date date NOT NULL,
  tour_time text NOT NULL,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text NOT NULL,
  student_name text,
  notes text,
  email_parent_sent boolean DEFAULT false,
  email_director_sent boolean DEFAULT false,
  slack_reminder_sent boolean NOT NULL DEFAULT false,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_recorridos_pkey PRIMARY KEY (id),
  CONSTRAINT tour_recorridos_tour_time_check CHECK (tour_time ~ '^[0-9]{1,2}:[0-9]{2}$'::text),
  CONSTRAINT tour_recorridos_level_check CHECK (level = ANY (ARRAY['maternal'::text, 'kinder'::text, 'primaria'::text, 'secundaria'::text]))
);
CREATE INDEX idx_tour_recorridos_created ON public.tour_recorridos USING btree (created_at DESC);
CREATE INDEX idx_tour_recorridos_date ON public.tour_recorridos USING btree (tour_date);
CREATE INDEX idx_tour_recorridos_level ON public.tour_recorridos USING btree (level);
CREATE TRIGGER trg_tour_recorridos_updated_at BEFORE UPDATE ON public.tour_recorridos FOR EACH ROW EXECUTE FUNCTION public.agendaw_set_updated_at();

CREATE TABLE public.blocked_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  block_date date NOT NULL,
  level text NOT NULL,
  reason text,
  block_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_dates_pkey PRIMARY KEY (id),
  CONSTRAINT blocked_dates_level_check CHECK (level = ANY (ARRAY['maternal_kinder'::text, 'primaria'::text, 'secundaria'::text]))
);
CREATE UNIQUE INDEX idx_blocked_by_slot ON public.blocked_dates USING btree (block_date, level, block_time) WHERE (block_time IS NOT NULL);
CREATE INDEX idx_blocked_dates_date_level ON public.blocked_dates USING btree (block_date, level);
CREATE UNIQUE INDEX idx_blocked_full_day ON public.blocked_dates USING btree (block_date, level) WHERE (block_time IS NULL);

CREATE TABLE public.admission_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  time_slot text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admission_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT admission_schedules_level_time_slot_key UNIQUE (level, time_slot),
  CONSTRAINT admission_schedules_level_check CHECK (level = ANY (ARRAY['maternal_kinder'::text, 'primaria'::text, 'secundaria'::text]))
);
CREATE INDEX idx_admission_schedules_level ON public.admission_schedules USING btree (level);

ALTER TABLE public.admission_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_permission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_inicial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendaw_wsp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_recorridos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY agendaw_deny_anon ON public.admission_appointments FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.admission_permission_requests FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.expediente_inicial FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.agendaw_wsp FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.tour_recorridos FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.blocked_dates FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY agendaw_deny_anon ON public.admission_schedules FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
