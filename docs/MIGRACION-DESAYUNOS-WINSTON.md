# Migración InsForge: Desayunos (`5g4kw6fw`) → Winston Servicios (`g4ta4bfg`)

Fecha: 2026-09-18  
Apps: `servicios_admin` (`/pos`, reportes Ludy/contable, notificaciones) y `~/Proyectos/services` (portal familias).

## Política

- **No se tocaron** tablas ya en producción en Winston (p. ej. `portal_news_desayunos` quedó intacta con sus 5 filas).
- Solo `CREATE IF NOT EXISTS` + `INSERT` en tablas vacías nuevas.
- Sin `UPDATE` / `DELETE` / `TRUNCATE` sobre datos Winston.

## Tablas POS migradas

| Tabla | Filas copiadas | Notas |
|--|--:|--|
| `concepto_desayunos` | 10 | catálogo POS |
| `desayunos_saldo` | 2 | |
| `pago_desayunos` | 0 | vacía en origen |
| `notificaciones` | 9 | |

Schema: `migrations/20260918120000_restore-desayunos-pos-tables.sql`  
Script copia: `scripts/migrar-desayunos-a-winston.mjs` (idempotente: SKIP si destino ya tiene filas).

## Cutover código

1. `src/lib/desayunosInsforge.ts` — usa Winston (`g4ta4bfg`); ignora NANO viejo si aún está en env.
2. `.env.local`: `INSFORGE_DESAYUNOS_*` → `https://g4ta4bfg.us-east.insforge.app`
3. Local: `node scripts/setup-desayunos-env.mjs`
4. Vercel `servicios-admin`: `node scripts/setup-desayunos-winston-vercel-env.mjs`
5. Repo `services`: `node scripts/setup-insforge-env.mjs` (link CLI a Winston) + vars Vercel del proyecto `services`

## Borrar NANO Desayunos

Solo cuando Mario confirme smoke OK en:

- [ ] `/pos` (productos / venta)
- [ ] Reportes Ludy / contable del día
- [ ] Portal `services` (saldo / pedidos familias)

Entonces se puede eliminar el proyecto InsForge **Desayunos** (`5g4kw6fw` / id `66300696-…`).
