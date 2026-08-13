# AGENTS.md

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **Winston Servicios** (API base `https://g4ta4bfg.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->

## Facturación CFDI — estado y pendientes

Módulo en `/facturacion` (rama `desayunos`). Roadmap detallado: `docs/FACTURACION-CFDI-ROADMAP.md`.

### Política de producción (no cambiar sin Mario)

- **`cfdiwinston` (PHP) sigue en producción** hasta que Mario lo indique explícitamente.
- **Re-sync `datos_facturacion`** MySQL/phpMyAdmin → InsForge **solo al go-live**, cuando Mario lo pida.
- El enlace al legacy en `/facturacion` es respaldo operativo, no corte automático.

### Hecho (Fases 1–4)

- Hub `/facturacion`, portal papás `/portal-facturacion`, schema InsForge (`datos_facturacion`, `cfdi_timbrado`, `cfdi_cancelacion`, `cfdi_nota_credito`).
- Timbrado: individual, por mes, público en general (`/api/facturacion/timbrar`).
- Timbres, cancelaciones (`/api/facturacion/cancelar`), devoluciones / nota de crédito (`/api/facturacion/nota-credito`).
- Credenciales PAC `FACTUROPORTI_*` en Vercel (`scripts/setup-facturoporti-vercel-env.mjs`).
- Tema UI: Totality (mismo que Desayunos POS).

### Diseño global Totality Festival + light/dark

- **Tema:** Totality Festival (eclipse cósmico: obsidiana + oro `#fff6df` + cian `#00e3fd`). Space Grotesk en títulos/labels; Inter en cuerpo.
- **Modo claro/oscuro:** `ThemeToggle` + `data-theme` en `<html>`; persistencia en `localStorage` (`servicios-admin-theme` en este repo).
- **CSS raíz:** `src/app/pos/pos-totality-theme.css` + `src/app/admin-totality-overrides.css` + `src/app/facturacion/facturacion-totality-overrides.css`.
- **Módulo `/servicios`:** claro con **UI UX PRO MAX** (navy + slate); oscuro con **Totality Festival** (`servicios-original-theme.css`, `servicios-totality-alumno.css`, `servicios-totality-dark.css`). Mismo `ThemeToggle`.
- **Responsivo:** todo el proyecto debe verse y usarse bien en **PC y móvil** (ver `.cursor/rules/responsive-design.mdc`).
- **Excluidos (sin cambio de diseño ni toggle):**
  - AgendaW: `/admin` y rutas de directoras (`agendaw`).
  - Open House: `open_house/app/admin`.
- **Otros repos alineados:** `prorrogas_ajustes`, `Cchic` (cada uno con su clave `localStorage` propia).

### Pendiente para terminar el sistema nuevo

1. **Pruebas PAC en Vercel** — Smoke test Banorte CE + timbrado; si 401, renovar bearer FacturoPorTi.
2. **Logos CFDI** — `assets/cfdi/escudo.png` (Winston 200×200) y `educativo.png` (IEW 84×76); mismos del Banorte legacy. Env `*_LOGO_BASE64` opcional.
3. **Reporte contadores** — Sustituir `winston93.edu.mx/xml` (Fase 5).
4. **Nota de crédito** — Persistencia XML/PDF en bucket `cfdi` (timbrado Banorte/admin ya sube a Storage).

### Hecho reciente (Banorte CE + Storage)

- Bucket InsForge `cfdi` (público).
- Tras pago Banorte aprobado: `timbrarReferencia` + upload XML/PDF; falló PAC → pago queda, factura pendiente.
- Proxy `/api/facturacion/archivo?f=factura….pdf|xml` **solo InsForge** (sin fallback hosting).
- Migración script `scripts/migrar-facturas-cfdi-insforge.mjs` (copia inicial desde hosting → bucket `cfdi`).

### Go-live (cuando Mario lo pida)

5. Re-sync final `datos_facturacion` desde MySQL.
6. Deploy + smoke test operativo con contabilidad.
7. Uso en paralelo con `cfdiwinston` hasta confianza operativa.

### Corte legacy (solo con OK explícito de Mario)

8. Apagar o redirigir `winston93.edu.mx/cfdiwinston`.
9. Retirar credenciales del PHP en GitLab/servidor.
10. Confirmar `/portal-facturacion` como única vía de datos fiscales de papás.

## Boletas secundaria + hub Becas

- **Hub:** `/becas` (5 cards: Renovaciones, Solicitudes, Permisos, Bitácora, Boletas secundaria). La tarjeta **Becas** del dashboard apunta aquí.
- **Módulo:** `/boletas-secundaria` — login maestro/admin, captura, admin, PDF, reportes (ciclos históricos), envío email autenticado.
- **Backend:** proyecto InsForge dedicado **`boletas`** (API `https://5u3i4tmc.us-east.insforge.app`). Schema/import en `insforge-boletas/`.
- **Env (solo server):** `BOLETAS_INSFORGE_URL`, `BOLETAS_INSFORGE_API_KEY` (opcional `BOLETAS_SESSION_SECRET`).
- Legacy PHP `winston93.edu.mx/boletas` convive; no sustituir hasta OK de Mario.
