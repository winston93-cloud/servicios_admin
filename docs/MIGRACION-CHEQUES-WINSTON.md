# Migración InsForge: Cheques (`3p3q5w7a`) → Winston Servicios (`g4ta4bfg`)

Fecha: 2026-09-19  
App: `~/Proyectos/cheques_new` — **Cheques** (`cheques-new.vercel.app`), tarjeta del dashboard admin en `servicios_admin`.

## Política

- Winston **no tenía** estas tablas (sin colisión con prod).
- Solo `CREATE IF NOT EXISTS` + `INSERT` en tablas vacías.
- Sin `UPDATE` / `DELETE` / `TRUNCATE` sobre datos Winston.

## Tablas migradas

| Tabla | Filas |
|--|--:|
| `ch_nombres` | 251 |
| `ch_conceptos` | 51 |
| `ch_subconceptos` | 141 |
| `cheques_banco` | 200 |
| `ch_cheques` | 1562 |
| `ch_cheques_ed` | 248 |
| `ch_cheques_sw` | 9 |
| `ch_cheques_se` | 53 |

Schema: `migrations/20260919120000_cheques-tables-winston.sql`  
Script: `scripts/migrar-cheques-a-winston.mjs`

## Cutover

1. Repo `cheques_new`: `node scripts/setup-vercel-winston-env.mjs` (env local + Vercel + deploy)
2. `servicios_admin` solo enlaza UI (`urlChequesApp` → `cheques-new.vercel.app`); no usa el NANO directo.

## Borrar NANO Cheques

Cuando Mario confirme smoke OK: eliminar proyecto InsForge **Cheques** (`3p3q5w7a` / id `9c8e157a-…`).
