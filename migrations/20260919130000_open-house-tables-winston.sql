-- Open House → Winston Servicios (espejo NANO ebcv45bg / open-house-chi)
-- Solo CREATE IF NOT EXISTS; sin tocar datos existentes.

CREATE TABLE IF NOT EXISTS inscripciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_aspirante varchar(255) NOT NULL,
  nivel_academico varchar(50) NOT NULL,
  grado_escolar varchar(100) NOT NULL,
  fecha_nacimiento date NOT NULL,
  nombre_padre varchar(255) NOT NULL,
  nombre_madre varchar(255) NOT NULL,
  telefono varchar(20) NOT NULL,
  whatsapp varchar(20) DEFAULT ''::character varying,
  email varchar(255) NOT NULL,
  direccion text NOT NULL,
  fecha_inscripcion timestamptz DEFAULT now(),
  reminder_sent boolean DEFAULT false,
  reminder_scheduled_for timestamptz,
  reminder_sent_at timestamptz,
  confirmacion_asistencia varchar(20) DEFAULT 'pendiente'::character varying,
  fecha_confirmacion timestamptz,
  ciclo_escolar varchar(20) DEFAULT '2025'::character varying,
  edicion_open_house varchar(32),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inscripciones_ciclo ON public.inscripciones USING btree (ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_inscripciones_confirmacion_asistencia ON public.inscripciones USING btree (confirmacion_asistencia);
CREATE INDEX IF NOT EXISTS idx_inscripciones_edicion_open_house ON public.inscripciones USING btree (edicion_open_house);
CREATE INDEX IF NOT EXISTS idx_inscripciones_email ON public.inscripciones USING btree (email);
CREATE INDEX IF NOT EXISTS idx_inscripciones_fecha_inscripcion ON public.inscripciones USING btree (fecha_inscripcion);
CREATE INDEX IF NOT EXISTS idx_inscripciones_nivel_academico ON public.inscripciones USING btree (nivel_academico);
CREATE INDEX IF NOT EXISTS idx_inscripciones_reminder_scheduled ON public.inscripciones USING btree (reminder_scheduled_for);
CREATE INDEX IF NOT EXISTS idx_inscripciones_reminder_sent ON public.inscripciones USING btree (reminder_sent);

CREATE TABLE IF NOT EXISTS sesiones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_aspirante varchar(255) NOT NULL,
  nivel_academico varchar(50) NOT NULL,
  grado_escolar varchar(50) NOT NULL,
  fecha_nacimiento date NOT NULL,
  genero varchar(20),
  escuela_procedencia varchar(255),
  nombre_padre varchar(255) NOT NULL,
  nombre_madre varchar(255) NOT NULL,
  telefono varchar(20) NOT NULL,
  whatsapp varchar(20) DEFAULT ''::character varying,
  email varchar(255) NOT NULL,
  direccion text NOT NULL,
  parentesco varchar(50),
  personas_asistiran varchar(20),
  medio_entero varchar(50),
  fecha_inscripcion timestamptz DEFAULT now(),
  reminder_sent boolean DEFAULT false,
  reminder_scheduled_for timestamptz,
  reminder_sent_at timestamptz,
  confirmacion_asistencia varchar(20),
  fecha_confirmacion timestamptz,
  ciclo_escolar varchar(20) DEFAULT '2025'::character varying,
  edicion_sesiones varchar(32),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_ciclo ON public.sesiones USING btree (ciclo_escolar);
CREATE INDEX IF NOT EXISTS idx_sesiones_confirmacion ON public.sesiones USING btree (confirmacion_asistencia);
CREATE INDEX IF NOT EXISTS idx_sesiones_edicion_sesiones ON public.sesiones USING btree (edicion_sesiones);
CREATE INDEX IF NOT EXISTS idx_sesiones_email ON public.sesiones USING btree (email);
CREATE INDEX IF NOT EXISTS idx_sesiones_fecha_inscripcion ON public.sesiones USING btree (fecha_inscripcion);
CREATE INDEX IF NOT EXISTS idx_sesiones_nivel_academico ON public.sesiones USING btree (nivel_academico);
CREATE INDEX IF NOT EXISTS idx_sesiones_reminder_sent ON public.sesiones USING btree (reminder_sent);

CREATE TABLE IF NOT EXISTS kommo_lead_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kommo_lead_id bigint NOT NULL,
  kommo_contact_id bigint,
  nombre varchar(255) NOT NULL,
  telefono varchar(20) NOT NULL,
  email varchar(255),
  plantel varchar(20) NOT NULL,
  last_contact_time timestamptz NOT NULL,
  sms_24h_sent boolean DEFAULT false,
  sms_24h_sent_at timestamptz,
  sms_24h_tag_added boolean DEFAULT false,
  sms_48h_sent boolean DEFAULT false,
  sms_48h_sent_at timestamptz,
  sms_72h_sent boolean DEFAULT false,
  sms_72h_sent_at timestamptz,
  pipeline_id bigint,
  status_id bigint,
  responsible_user_id bigint,
  lead_status varchar(50) DEFAULT 'active'::character varying,
  last_webhook_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kommo_lead_id ON public.kommo_lead_tracking USING btree (kommo_lead_id);
CREATE INDEX IF NOT EXISTS idx_last_contact_time ON public.kommo_lead_tracking USING btree (last_contact_time);
CREATE INDEX IF NOT EXISTS idx_lead_status ON public.kommo_lead_tracking USING btree (lead_status);
CREATE INDEX IF NOT EXISTS idx_plantel ON public.kommo_lead_tracking USING btree (plantel);
CREATE INDEX IF NOT EXISTS idx_sms_24h_sent ON public.kommo_lead_tracking USING btree (sms_24h_sent);
CREATE INDEX IF NOT EXISTS idx_sms_48h_sent ON public.kommo_lead_tracking USING btree (sms_48h_sent);
CREATE INDEX IF NOT EXISTS idx_sms_72h_sent ON public.kommo_lead_tracking USING btree (sms_72h_sent);
CREATE UNIQUE INDEX IF NOT EXISTS kommo_lead_tracking_kommo_lead_id_key ON public.kommo_lead_tracking USING btree (kommo_lead_id);

CREATE TABLE IF NOT EXISTS campamento_verano (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_participante varchar(255) NOT NULL,
  fecha_nacimiento date NOT NULL,
  edad smallint NOT NULL,
  grado_escolar varchar(100) NOT NULL,
  nombre_tutor varchar(255) NOT NULL,
  telefono_principal varchar(20) NOT NULL,
  telefono_emergencia varchar(20) NOT NULL,
  email varchar(255) NOT NULL,
  tiene_alergias boolean NOT NULL DEFAULT false,
  alergias_detalle text,
  autoriza_primeros_auxilios boolean NOT NULL DEFAULT false,
  autoriza_fotos boolean NOT NULL DEFAULT false,
  acepta_reglamento boolean NOT NULL DEFAULT false,
  fecha_firma date NOT NULL,
  plan_campamento varchar(20) NOT NULL,
  plan_precio numeric NOT NULL,
  semanas_seleccionadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  folio varchar(10),
  edicion varchar(20) NOT NULL DEFAULT '2025'::character varying,
  fecha_inscripcion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kit_bienvenida boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_campamento_verano_edicion ON public.campamento_verano USING btree (edicion);
CREATE INDEX IF NOT EXISTS idx_campamento_verano_email ON public.campamento_verano USING btree (email);
CREATE INDEX IF NOT EXISTS idx_campamento_verano_fecha_inscripcion ON public.campamento_verano USING btree (fecha_inscripcion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campamento_verano_folio_unique ON public.campamento_verano USING btree (folio) WHERE (folio IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_campamento_verano_plan ON public.campamento_verano USING btree (plan_campamento);

CREATE TABLE IF NOT EXISTS taller_ia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  apellido varchar(100) NOT NULL,
  puesto varchar(100) NOT NULL,
  grado_clase varchar(50) NOT NULL,
  institucion_procedencia varchar(200) NOT NULL,
  email varchar(150) NOT NULL,
  whatsapp varchar(20) NOT NULL,
  experiencia_ia boolean NOT NULL DEFAULT false,
  fecha_registro timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taller_ia_email ON public.taller_ia USING btree (email);
CREATE INDEX IF NOT EXISTS idx_taller_ia_fecha_registro ON public.taller_ia USING btree (fecha_registro);
CREATE INDEX IF NOT EXISTS idx_taller_ia_institucion ON public.taller_ia USING btree (institucion_procedencia);

ALTER TABLE inscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE kommo_lead_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE campamento_verano ENABLE ROW LEVEL SECURITY;
ALTER TABLE taller_ia ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY public_insert_inscripciones ON inscripciones FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY public_insert_sesiones ON sesiones FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY public_insert_campamento_verano ON campamento_verano FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY public_insert_taller_ia ON taller_ia FOR INSERT TO anon, authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- update_updated_at_column ya existe en Winston (caja chica / otros)
DROP TRIGGER IF EXISTS update_inscripciones_updated_at ON inscripciones;
CREATE TRIGGER update_inscripciones_updated_at
  BEFORE UPDATE ON inscripciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kommo_tracking_updated_at ON kommo_lead_tracking;
CREATE TRIGGER update_kommo_tracking_updated_at
  BEFORE UPDATE ON kommo_lead_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS campamento_verano_updated_at ON campamento_verano;
CREATE TRIGGER campamento_verano_updated_at
  BEFORE UPDATE ON campamento_verano FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
