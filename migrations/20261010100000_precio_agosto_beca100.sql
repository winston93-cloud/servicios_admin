-- Cuota de inicio de curso (concepto 00) para alumnos con beca 100% activa en el ciclo
-- («cuota hijos de maestros»). 0 = sin tarifa especial: se cobra precio_agosto normal.
alter table public.pago_boucher_precio
  add column if not exists precio_agosto_beca100 numeric(10,2) not null default 0;

-- Tarifas iniciales (2025-2026 y 2026-2027). Bandas: 1 Maternal+K1, 2 K2/K3, 3 Primaria, 4 Secundaria.
update public.pago_boucher_precio p
set precio_agosto_beca100 = v.monto
from (values
  (22, 1, 980.00), (22, 2, 990.00), (22, 3, 1000.00), (22, 4, 1020.00),
  (23, 1, 1030.00), (23, 2, 1050.00), (23, 3, 1100.00), (23, 4, 1120.00)
) as v(ciclo, nivel, monto)
join public.ciclos_escolares c on c.valor = v.ciclo
where p.precio_ciclo_escolar = v.ciclo and p.alumno_nivel = v.nivel
  and c.nombre in ('2025-2026', '2026-2027');
