# AgendaW en Winston Servicios

Desde **2026-10-05** las tablas de admisión viven en InsForge **Winston Servicios** (`g4ta4bfg`).
El proyecto InsForge **AgendaW** (`sr6a9iza`) quedó retirado: el código de agendaw rechaza esa URL.

- App: **agendaw.vercel.app** (repo `~/Proyectos/agendaw`): papás (`/agendar`), admin psicólogas/vinculación (`/admin`), directoras (`/admin/dashboard`).
- Todo el acceso a datos es del servidor con `WINSTON_SERVICIOS_URL` + `WINSTON_SERVICIOS_API_KEY` (`src/lib/insforge/server.ts`).
- servicios_admin lee `admission_appointments` para el reporte de nuevo ingreso con su cliente Winston normal (`src/lib/admissionInsforgeAdmin.ts`).

## Tablas

| Tabla | Uso |
|-------|-----|
| `admission_appointments` | Citas (papás, panel psicólogas) |
| `admission_schedules` | Horarios por nivel |
| `blocked_dates` | Bloqueos de fechas/horas |
| `admission_permission_requests` | Autorizaciones de directoras |
| `expediente_inicial` | Expediente del aspirante |
| `tour_recorridos` | Recorridos de vinculación |
| `agendaw_wsp` | Histórico de comprobantes WSP de AgendaW (antes `wsp`; renombrada por choque con `wsp` de Winston). Los comprobantes nuevos se guardan en `wsp` de Winston. |

RLS activo con política `agendaw_deny_anon` (solo la API key del servidor accede).

## Migración

- Esquema: `migrations/agendaw/20261005120000_agendaw_en_winston_servicios.sql`.
- Espejo/verificación: `node --env-file=.env.local scripts/migrar-agendaw-a-winston.mjs [--copiar] [--borrar-sobrantes]`.
- `migrations/agendaw/OBSOLETO-NO-EJECUTAR_*`: no ejecutar (borra `wsp` de Winston).

## Autenticación

La agenda (admin y directoras) usa el login de **agendaw.vercel.app** (PIN por área/nivel).
Desde el dashboard de servicios_admin solo hay enlaces externos a esas URLs.
