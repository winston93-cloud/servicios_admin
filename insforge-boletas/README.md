# InsForge proyecto `boletas`

Backend dedicado para boletas (Kinder / Primaria / Secundaria). API: `https://5u3i4tmc.us-east.insforge.app`.

## Estado (2026-09-15)

Schema aplicado en el proyecto **Boletas** (tablas base + kinder ES/EN + primaria ES/EN).
Catálogo secundaria sembrado. Alumnos operativos presentes (~2.3k).

Este directorio tiene su propio `.insforge/` (link a Boletas). La raíz del repo sigue en **Winston Servicios**.

## Migraciones

```bash
cd insforge-boletas
npx -y @insforge/cli@latest login
npx -y @insforge/cli@latest link --project-id 4a695124-3af9-4b2e-945a-0df93df222e6
# Preferir import (multi-statement):
npx -y @insforge/cli@latest db import migrations/20260813120000_boletas_schema.sql
npx -y @insforge/cli@latest db import migrations/20260813120100_boletas_seed_catalog.sql
npx -y @insforge/cli@latest db import migrations/20260915130000_kinder_espanol.sql
npx -y @insforge/cli@latest db import migrations/20260915140000_kinder_ingles.sql
npx -y @insforge/cli@latest db import migrations/20260915150000_primaria_espanol.sql
npx -y @insforge/cli@latest db import migrations/20260915160000_primaria_ingles.sql
```

## Secrets en servicios_admin

`.env.local` / Vercel (solo server) — ya configurados en producción/preview/development:

```
BOLETAS_INSFORGE_URL=https://5u3i4tmc.us-east.insforge.app
BOLETAS_INSFORGE_API_KEY=<api key del proyecto>
BOLETAS_SESSION_SECRET=<secreto sesión>
```

## App

- Hub: `/boletas`
- Módulos: `/boletas/kinder-espanol`, `kinder-ingles`, `primaria-espanol`, `primaria-ingles`, `/boletas-secundaria`

## Sync roster `alumno` (Winston → Boletas)

Si el listado sale vacío en el ciclo actual, re-sincroniza desde Winston Servicios:

```bash
node --env-file=.env.local scripts/sync-alumno-winston-a-boletas.mjs
# o solo un ciclo: --ciclo=23
```
- Envío email unificado: `POST /api/boletas-envio` `{ modulo, alumnoId, bimestre, ciclo }`
