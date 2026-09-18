# Migración InsForge: Caja Chica (`fvddcfy5`) → Winston Servicios (`g4ta4bfg`)

Fecha: 2026-09-18  
App: `~/Proyectos/Cchic` — **Monitoreo y Control** (`cchic.vercel.app`), tarjeta del dashboard admin en `servicios_admin`.

## Política

- Winston **no tenía** estas tablas (sin colisión con prod).
- Solo `CREATE IF NOT EXISTS` + `INSERT` en tablas vacías.
- No se reemplazó `update_updated_at_column` (ya existía en Winston).
- Sin `UPDATE` / `DELETE` / `TRUNCATE` sobre datos Winston.

## Tablas migradas

| Tabla | Filas |
|--|--:|
| `categories` | 7 |
| `persons` | 8 |
| `executors` | 4 |
| `subcategories` | 0 |
| `funds` | 4 |
| `expenses` | 4 |
| `person_categories` | 1 |
| `custom_periods` | 1 |

Schema: `migrations/20260918140000_caja-chica-pos-tables.sql`  
Script: `scripts/migrar-caja-chica-a-winston.mjs`

## Cutover

1. Repo `Cchic`: `node scripts/setup-insforge-env.mjs` (link CLI → Winston)
2. Vercel `cchic`: `node scripts/setup-vercel-env.mjs`
3. `servicios_admin` solo enlaza UI (`NEXT_PUBLIC_CCHIC_URL` → `cchic.vercel.app`); no usa el NANO directo.

## Borrar NANO Caja Chica

Cuando Mario confirme: eliminar proyecto InsForge **Caja Chica** (`fvddcfy5` / id `e02836a4-…`).
