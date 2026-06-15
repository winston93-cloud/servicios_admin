# RLS en InsForge — Winston Servicios

## Arquitectura actual

| Capa | Clave | RLS |
|------|-------|-----|
| Navegador (POS, panel, portal) | `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Aplica |
| Rutas API Next.js | `INSFORGE_API_KEY` | Bypass (admin) |

El login **no** usa InsForge Auth (`auth.uid()`). Usa tablas `usuario` / `alumno` + `localStorage`.

## Issues del Backend Advisor (27)

### Resueltos con `migrations/20260615150000_insforge_rls_security_advisor.sql`

1. **`alumno_dato_medico`** — RLS activado; acceso solo vía API (`/api/portal-inscripciones/solicitud` usa admin).
2. **10 tablas solo-servidor** — Política `servicios_insforge_deny_anon` (`USING (false)`) para `anon` y `authenticated`. Las rutas API con `INSFORGE_API_KEY` siguen funcionando.

### Pendientes (16) — políticas permisivas `servicios_insforge_anon_*`

Tablas: `alumno`, `alumno_beca`, `alumno_contacto`, `alumno_detalles`, `alumno_familiar`, `ciclos_escolares`, `concepto_*`, `pago_*`, `personal`, `usuario`, etc.

Tienen `USING (true) WITH CHECK (true)` porque el **cliente** hace `insert`/`update`/`select` directo con la anon key (p. ej. POS desayunos, login, búsqueda de alumnos).

El asesor las marca como críticas **con razón**: cualquiera con la anon key (visible en el bundle) puede leer y modificar esas tablas.

### Cierre real (fase 2)

1. Mover cada operación del navegador a una ruta `src/app/api/...` que use `createDbAdmin()`.
2. Validar sesión en servidor (cookie firmada o JWT propio; no solo `alumnoId` en query).
3. Sustituir políticas permisivas por `servicios_insforge_deny_anon` en esas tablas.
4. Retirar `NEXT_PUBLIC_INSFORGE_ANON_KEY` del cliente cuando no quede ningún `supabase.from()` en el bundle.

Prioridad sugerida: `usuario` (login) → `personal` → `alumno*` → pagos.

## Scripts

- `sql/insforge_rls_servicios.sql` — políticas permisivas legacy (panel/portal).
- `migrations/20260615150000_insforge_rls_security_advisor.sql` — parche del asesor (11 issues).

## Aplicar en InsForge

```bash
insforge db query "$(cat migrations/20260615150000_insforge_rls_security_advisor.sql)"
```

O pegar el SQL en **Dashboard → SQL Editor → Run**.
