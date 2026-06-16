# RLS en InsForge — Winston Servicios

## Arquitectura (fase 2 aplicada)

| Capa | Acceso a tablas |
|------|-----------------|
| Navegador | `fetch` → `/api/database/records/*` (requiere sesión en `localStorage`) |
| Rutas API Next.js | `createDbAdmin()` → `INSFORGE_API_KEY` |
| InsForge anon key | **Sin acceso** a las 16 tablas operativas (`deny_anon`) |

Login: `POST /api/auth/login` (servidor valida `usuario` / `alumno`).

## Scripts SQL

| Archivo | Qué hace |
|---------|----------|
| `migrations/20260615150000_insforge_rls_security_advisor.sql` | 11 tablas solo-servidor + `alumno_dato_medico` |
| `migrations/20260615160000_insforge_rls_deny_client_tables.sql` | 16 tablas del panel/POS/portal → `deny_anon` |

**Orden:** desplegar la app en Vercel **antes** de ejecutar el script de las 16 tablas.

```bash
insforge db query "$(cat migrations/20260615160000_insforge_rls_deny_client_tables.sql)"
```

## Advisor

Tras deploy + SQL, el Backend Advisor debería quedar en **0 critical** (rescan en Dashboard).

`NEXT_PUBLIC_INSFORGE_ANON_KEY` ya no se usa para consultas de tablas desde el navegador; puede quedarse en Vercel por compatibilidad del SDK hasta retirarlo.
