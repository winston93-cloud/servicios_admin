# Migración InsForge: Boletas (5u3i4tmc) → Winston Servicios (g4ta4bfg)

Fecha: 2026-09-17  
App: `servicios_admin` (`/boletas`, `/boletas-secundaria`, APIs `boletas-*`)

## Qué se migró

| Tabla | Filas | Notas |
|--|--:|--|
| `boleta_calificacion` | 34072 | |
| `boleta_conducta` | 34072 | |
| `boleta_inasistencia` | 34070 | |
| `boleta_comprension_lectora` | 2502 | |
| `boleta_recuperacion` | 82 | |
| `promedio_ciclo` | 461 | |
| tablas kinder/primaria EN/ES | 0 | schema vacío |

**No se sobreescribió** (Winston ya era fuente o tenía más filas):

- `alumno`, `alumno_detalles`, `alumno_familiar`, `usuario`
- `boleta_materia` (133 en Winston vs 43 en NANO)
- `boleta_maestro` / `boleta_maestro_grupo` (se **añadieron** 8 maestros + 102 grupos faltantes)

## Cutover

1. `.env.local` / `env.example`: `BOLETAS_INSFORGE_*` → `g4ta4bfg`
2. Vercel: `node scripts/setup-boletas-winston-vercel-env.mjs`
3. Smoke `/boletas` y `/boletas-secundaria`
4. Luego eliminar NANO **Boletas** en InsForge

## Sync roster

`scripts/sync-alumno-winston-a-boletas.mjs` queda como no-op útil solo si hubiera drift; origen y destino son el mismo proyecto.
