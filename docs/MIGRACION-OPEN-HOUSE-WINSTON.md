# Migración InsForge: Open_House (`ebcv45bg`) → Winston Servicios (`g4ta4bfg`)

Fecha: 2026-09-19  
App: `~/Proyectos/open_house` — **Open House / Sesiones Inf.** (`open-house-chi.vercel.app`), tarjeta del dashboard admin.

## Política

- Winston **no tenía** estas tablas (sin colisión con prod).
- Solo `CREATE IF NOT EXISTS` + `INSERT` en tablas vacías.
- Sin `UPDATE` / `DELETE` / `TRUNCATE` sobre datos Winston.

## Tablas migradas

| Tabla | Filas |
|--|--:|
| `inscripciones` | 225 |
| `sesiones` | 93 |
| `kommo_lead_tracking` | 1828 |
| `campamento_verano` | 78 |
| `taller_ia` | 5 |

Schema: `migrations/20260919130000_open-house-tables-winston.sql`  
Script: `scripts/migrar-open-house-a-winston.mjs`

## Cutover

1. Repo `open_house`: `node scripts/setup-vercel-winston-env.mjs` (env local + Vercel + deploy)
2. `servicios_admin` enlaza UI a `https://open-house-chi.vercel.app/admin`.

## Borrar NANO Open_House

Cuando Mario confirme smoke OK: eliminar proyecto InsForge **Open_House** (`ebcv45bg` / id `7644e58c-…`).
