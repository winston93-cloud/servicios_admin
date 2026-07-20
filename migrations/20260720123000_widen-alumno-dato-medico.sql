-- Alinear longitudes de alumno_dato_medico con MySQL winston_general
-- (phpMyAdmin). El VARCHAR(5) de sangre bloqueaba guardados tipo "A POSITIVO".

ALTER TABLE public.alumno_dato_medico
  ALTER COLUMN alumno_peso TYPE VARCHAR(30),
  ALTER COLUMN alumno_estatura TYPE VARCHAR(30),
  ALTER COLUMN alumno_sangre_tipo TYPE VARCHAR(30),
  ALTER COLUMN alumno_alergia TYPE VARCHAR(250),
  ALTER COLUMN alumno_padecimiento TYPE VARCHAR(200),
  ALTER COLUMN alumno_medicina TYPE VARCHAR(200),
  ALTER COLUMN alumno_suministrar TYPE VARCHAR(200),
  ALTER COLUMN alumno_medicamentos TYPE VARCHAR(200);
