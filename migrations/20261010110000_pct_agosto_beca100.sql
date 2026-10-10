-- Cuota de inicio para beca 100%: se guarda el % que se baja de la cuota total (precio_agosto);
-- el monto se calcula al cobrar con la cuota total del ciclo. 0 = se cobra la cuota total.
alter table public.pago_boucher_precio
  add column if not exists pct_agosto_beca100 numeric(5,2) not null default 0;

update public.pago_boucher_precio
set pct_agosto_beca100 = round((1 - precio_agosto_beca100 / precio_agosto) * 100, 2)
where precio_agosto_beca100 > 0 and precio_agosto > 0 and pct_agosto_beca100 = 0;
