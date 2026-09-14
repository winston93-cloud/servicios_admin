-- Bitácora diaria de becarios (Kevin / Omar). Auth de usuarios en app (env), no en esta tabla.
CREATE TABLE IF NOT EXISTS becario_bitacora (
  entrada_id serial PRIMARY KEY,
  becario_username text NOT NULL,
  becario_nombre text NOT NULL,
  entrada_fecha date NOT NULL,
  entrada_titulo text NOT NULL DEFAULT '',
  avances text NOT NULL DEFAULT '',
  observaciones text NOT NULL DEFAULT '',
  apuntes text NOT NULL DEFAULT '',
  pendientes text NOT NULL DEFAULT '',
  aprendizajes text NOT NULL DEFAULT '',
  horas_aproximadas numeric(4,1),
  estado text NOT NULL DEFAULT 'publicado',
  entrada_creacion timestamptz NOT NULL DEFAULT now(),
  entrada_actualizacion timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT becario_bitacora_unico_dia UNIQUE (becario_username, entrada_fecha)
);

CREATE INDEX IF NOT EXISTS idx_becario_bitacora_fecha ON becario_bitacora (entrada_fecha DESC);
CREATE INDEX IF NOT EXISTS idx_becario_bitacora_user ON becario_bitacora (becario_username, entrada_fecha DESC);
