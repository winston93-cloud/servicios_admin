-- =============================================================================
-- iwc_gral_ins — ventanas de diferidos de reinscripción (legacy MySQL)
-- Una fila por ciclo de inscripción (ins_ce = cen).
--
-- Plan 10 meses (alumno.mes = 1) → columnas ins_cambio_lv_*
-- Plan 11 meses (alumno.mes = 2) → columnas ins_normal_*
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.iwc_gral_ins (
  ins_ce SMALLINT PRIMARY KEY,
  ins_cambio_lv_dif1_ini DATE NOT NULL,
  ins_cambio_lv_dif1_fin DATE NOT NULL,
  ins_cambio_lv_dif2_ini DATE NOT NULL,
  ins_cambio_lv_dif2_fin DATE NOT NULL,
  ins_normal_dif1_ini DATE NOT NULL,
  ins_normal_dif1_fin DATE NOT NULL,
  ins_normal_dif2_ini DATE NOT NULL,
  ins_normal_dif2_fin DATE NOT NULL
);

COMMENT ON TABLE public.iwc_gral_ins IS
  'Fechas de diferidos 1 y 2 de reinscripción por ciclo (legacy iwc_gral_ins).';

COMMENT ON COLUMN public.iwc_gral_ins.ins_ce IS 'Ciclo de inscripción/reinscripción (cen).';
COMMENT ON COLUMN public.iwc_gral_ins.ins_cambio_lv_dif1_ini IS 'Dif1 inicio — plan 10 meses (alumno.mes=1).';
COMMENT ON COLUMN public.iwc_gral_ins.ins_cambio_lv_dif1_fin IS 'Dif1 fin — plan 10 meses.';
COMMENT ON COLUMN public.iwc_gral_ins.ins_cambio_lv_dif2_ini IS 'Dif2 inicio — plan 10 meses (suele ser junio).';
COMMENT ON COLUMN public.iwc_gral_ins.ins_cambio_lv_dif2_fin IS 'Dif2 fin — plan 10 meses.';
COMMENT ON COLUMN public.iwc_gral_ins.ins_normal_dif1_ini IS 'Dif1 inicio — plan 11 meses (alumno.mes=2).';
COMMENT ON COLUMN public.iwc_gral_ins.ins_normal_dif1_fin IS 'Dif1 fin — plan 11 meses.';
COMMENT ON COLUMN public.iwc_gral_ins.ins_normal_dif2_ini IS 'Dif2 inicio — plan 11 meses (suele ser julio).';
COMMENT ON COLUMN public.iwc_gral_ins.ins_normal_dif2_fin IS 'Dif2 fin — plan 11 meses.';

INSERT INTO public.iwc_gral_ins (
  ins_ce,
  ins_cambio_lv_dif1_ini, ins_cambio_lv_dif1_fin,
  ins_cambio_lv_dif2_ini, ins_cambio_lv_dif2_fin,
  ins_normal_dif1_ini, ins_normal_dif1_fin,
  ins_normal_dif2_ini, ins_normal_dif2_fin
) VALUES
  (12, '2016-02-02', '2016-02-09', '2016-06-29', '2016-07-03', '2016-02-10', '2016-02-16', '2016-07-06', '2016-07-10'),
  (13, '2016-02-16', '2016-02-19', '2016-07-01', '2016-07-05', '2016-02-22', '2016-02-26', '2016-07-06', '2016-07-08'),
  (14, '2017-02-03', '2017-02-17', '2017-07-03', '2017-07-07', '2017-02-20', '2017-02-24', '2017-07-06', '2017-07-14'),
  (15, '2018-02-12', '2018-02-16', '2018-06-25', '2018-06-29', '2018-02-19', '2018-02-23', '2018-06-25', '2018-06-29'),
  (16, '2019-02-11', '2019-02-15', '2019-06-24', '2019-07-05', '2019-02-18', '2019-02-22', '2019-06-24', '2019-07-05'),
  (17, '2020-02-10', '2020-02-17', '2020-06-22', '2020-07-03', '2020-02-18', '2020-02-24', '2020-06-22', '2020-07-03'),
  (18, '2021-02-15', '2021-02-19', '2021-06-18', '2021-06-22', '2021-02-19', '2021-02-25', '2021-06-22', '2021-06-25'),
  (19, '2022-02-14', '2022-02-20', '2022-06-20', '2022-06-26', '2022-02-21', '2022-02-27', '2022-06-27', '2022-07-03'),
  (20, '2023-02-13', '2023-02-17', '2023-06-19', '2023-06-23', '2023-02-20', '2023-02-24', '2023-06-26', '2023-07-03'),
  (21, '2024-02-12', '2024-05-31', '2024-06-17', '2024-06-22', '2024-02-19', '2024-05-31', '2024-06-24', '2024-06-29')
ON CONFLICT (ins_ce) DO NOTHING;
