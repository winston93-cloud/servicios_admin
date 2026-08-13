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
