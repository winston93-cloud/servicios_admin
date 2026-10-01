-- Team English es solo de inglés Primaria (nivel 3).
delete from public.te_config where nivel <> 3;

alter table public.te_teacher drop constraint if exists te_teacher_nivel_check;
alter table public.te_teacher add constraint te_teacher_nivel_check check (nivel = 3);

alter table public.te_antecedente drop constraint if exists te_antecedente_nivel_check;
alter table public.te_antecedente add constraint te_antecedente_nivel_check check (nivel = 3);

alter table public.te_planeacion drop constraint if exists te_planeacion_nivel_check;
alter table public.te_planeacion add constraint te_planeacion_nivel_check check (nivel = 3);

alter table public.te_capacitacion drop constraint if exists te_capacitacion_nivel_check;
alter table public.te_capacitacion add constraint te_capacitacion_nivel_check check (nivel = 3);

alter table public.te_incidencia drop constraint if exists te_incidencia_nivel_check;
alter table public.te_incidencia add constraint te_incidencia_nivel_check check (nivel = 3);

alter table public.te_config drop constraint if exists te_config_nivel_check;
alter table public.te_config add constraint te_config_nivel_check check (nivel = 3);

alter table public.te_classroom drop constraint if exists te_classroom_nivel_check;
alter table public.te_classroom add constraint te_classroom_nivel_check check (nivel = 3);
