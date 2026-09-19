-- Cheques → Winston Servicios (espejo NANO 3p3q5w7a / cheques_new)
-- Solo CREATE IF NOT EXISTS; sin tocar datos existentes.

CREATE TABLE IF NOT EXISTS ch_nombres (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT,
  identificador TEXT
);

CREATE TABLE IF NOT EXISTS ch_conceptos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ch_subconceptos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  id_concepto BIGINT REFERENCES ch_conceptos(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cheques_banco (
  id BIGSERIAL PRIMARY KEY,
  cuenta TEXT,
  fecha_operacion TEXT,
  fecha TEXT,
  referencia TEXT,
  descripcion TEXT,
  cod_transac TEXT,
  sucursal TEXT,
  depositos TEXT,
  retiros TEXT,
  saldo TEXT,
  movimientos TEXT,
  descripcion_detallada TEXT,
  cheque TEXT
);

CREATE TABLE IF NOT EXISTS ch_cheques (
  idcheque BIGINT PRIMARY KEY,
  fecha DATE,
  nombre TEXT,
  concepto TEXT,
  subconcepto TEXT,
  observaciones TEXT,
  monto NUMERIC(14,2),
  estado TEXT,
  facturas TEXT,
  pagado TEXT,
  fechac DATE
);

CREATE TABLE IF NOT EXISTS ch_cheques_ed (
  idcheque BIGINT PRIMARY KEY,
  fecha DATE,
  nombre TEXT,
  concepto TEXT,
  subconcepto TEXT,
  observaciones TEXT,
  monto NUMERIC(14,2),
  estado TEXT,
  facturas TEXT,
  pagado TEXT,
  fechac DATE
);

CREATE TABLE IF NOT EXISTS ch_cheques_sw (
  idcheque BIGINT PRIMARY KEY,
  fecha DATE,
  nombre TEXT,
  concepto TEXT,
  subconcepto TEXT,
  observaciones TEXT,
  monto NUMERIC(14,2),
  estado TEXT,
  facturas TEXT,
  pagado TEXT,
  fechac DATE
);

CREATE TABLE IF NOT EXISTS ch_cheques_se (
  idcheque BIGINT PRIMARY KEY,
  fecha DATE,
  nombre TEXT,
  concepto TEXT,
  subconcepto TEXT,
  observaciones TEXT,
  monto NUMERIC(14,2),
  estado TEXT,
  facturas TEXT,
  pagado TEXT,
  fechac DATE
);

CREATE INDEX IF NOT EXISTS idx_ch_cheques_fecha ON ch_cheques(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_cheques_ed_fecha ON ch_cheques_ed(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_cheques_sw_fecha ON ch_cheques_sw(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_cheques_se_fecha ON ch_cheques_se(fecha);
CREATE INDEX IF NOT EXISTS idx_ch_nombres_nombre ON ch_nombres(nombre);
CREATE INDEX IF NOT EXISTS idx_ch_conceptos_nombre ON ch_conceptos(nombre);
CREATE INDEX IF NOT EXISTS idx_cheques_banco_ref ON cheques_banco(referencia);

ALTER TABLE ch_nombres ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_conceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_subconceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheques_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_cheques_ed ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_cheques_sw ENABLE ROW LEVEL SECURITY;
ALTER TABLE ch_cheques_se ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ch_nombres_all ON ch_nombres FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_conceptos_all ON ch_conceptos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_subconceptos_all ON ch_subconceptos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY cheques_banco_all ON cheques_banco FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_cheques_all ON ch_cheques FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_cheques_ed_all ON ch_cheques_ed FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_cheques_sw_all ON ch_cheques_sw FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY ch_cheques_se_all ON ch_cheques_se FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
