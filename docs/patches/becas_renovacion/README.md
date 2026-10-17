# Patch: promedio Winston en renovación (sin boleta SEP)

El agente cloud **no tiene push** a `winston93-cloud/becas_renovacion`.
Los cambios están listos en este patch/bundle para aplicar en ese repo.

## Aplicar

```bash
cd /ruta/a/becas_renovacion
git fetch origin
git checkout -b cursor/promedio-renovacion-sin-boleta-sep-d428 origin/main
git am < /ruta/a/servicios_admin/docs/patches/becas_renovacion/becas-renovacion-promedio-sin-boleta-sep.patch
# o:
# git pull /ruta/a/becas-renovacion-promedio-sin-boleta-sep.bundle HEAD
git push -u origin cursor/promedio-renovacion-sin-boleta-sep-d428
```

## Vercel / .env.local

Copiar desde `servicios_admin` las variables:

- `MYSQL_HOST`
- `MYSQL_PORT` (3306)
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE=winston_general`

Opcional: `node --env-file=.env.local scripts/setup-mysql-vercel-env.mjs --project=<VERCEL_PROJECT_ID>`

## Qué incluye

1. Renovación pide 3 PDFs (sin boleta SEP).
2. Admin detalle muestra Promedio ES / EN / general (ciclo `getCicloBecaARenovar()`, sin umbral ≥9).
3. Loaders MySQL portados (Kinder ES+EN, Primaria ES+EN, Secundaria).

---

# Patch: fix duplicate key al cambiar tipo de beca (admin)

Error: `duplicate key value violates unique constraint "alumno_beca_alumno_id_unique"` al guardar Hermanos → Socioeconómica en renovación.

## Aplicar

```bash
cd /ruta/a/becas_renovacion
git fetch origin
git checkout -b cursor/fix-alumno-beca-unique-384d origin/main
git am < /ruta/a/servicios_admin/docs/patches/becas_renovacion/fix-alumno-beca-unique.patch
git push -u origin cursor/fix-alumno-beca-unique-384d
```

## Qué corrige

`actualizarBecaRenovacionAdmin` buscaba `alumno_beca` por `alumno_id` + `beca_ciclo_escolar`. La tabla solo permite **una fila por alumno** (`UNIQUE(alumno_id)`). Si el ciclo en BD no coincidía con el ciclo origen, intentaba INSERT y fallaba. Ahora actualiza la fila existente del alumno.
