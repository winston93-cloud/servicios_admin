-- Cupo base del taller (mínimo / máximo). Cada grupo (taller_asignacion) lo hereda al crearse
-- y se puede ajustar por grupo desde Programados.

alter table public.taller add column if not exists cupo_min integer;
alter table public.taller add column if not exists cupo_max integer;

-- Si todos los grupos de un taller ya comparten el mismo cupo, ese es el cupo base.
update public.taller t
set cupo_max = s.cupo
from (
  select taller_id, min(cupo) as cupo
  from public.taller_asignacion
  where activo and cupo is not null
  group by taller_id
  having count(distinct cupo) = 1
) s
where s.taller_id = t.id and t.cupo_max is null;

update public.taller t
set cupo_min = s.cupo_min
from (
  select taller_id, min(cupo_min) as cupo_min
  from public.taller_asignacion
  where activo and cupo_min is not null
  group by taller_id
  having count(distinct cupo_min) = 1
) s
where s.taller_id = t.id and t.cupo_min is null;
