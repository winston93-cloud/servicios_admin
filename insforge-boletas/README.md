# InsForge proyecto `boletas` (consolidado)

Backend de boletas **consolidado en Winston Servicios** (`https://g4ta4bfg.us-east.insforge.app`).

El NANO `Boletas` (`5u3i4tmc`) queda deprecado tras cutover Vercel. Ver `docs/MIGRACION-BOLETAS-WINSTON.md`.

## Estado (2026-09-17)

Schema + datos de captura (secundaria) y schemas kinder/primaria en **Winston Servicios**.
Catálogo maestro/materia en Winston (superset + maestros faltantes mergeados).

Este directorio guarda migraciones SQL históricas. La raíz del repo sigue enlazada a **Winston Servicios**.

## Secrets en servicios_admin

`.env.local` / Vercel (solo server):

```
BOLETAS_INSFORGE_URL=https://g4ta4bfg.us-east.insforge.app
BOLETAS_INSFORGE_API_KEY=<api key Winston Servicios>
BOLETAS_SESSION_SECRET=<secreto sesión>
```

## App

- Hub: `/boletas`
- Módulos: `/boletas/kinder-espanol`, `kinder-ingles`, `primaria-espanol`, `primaria-ingles`, `/boletas-secundaria`
- Envío email unificado: `POST /api/boletas-envio` `{ modulo, alumnoId, bimestre, ciclo }`
