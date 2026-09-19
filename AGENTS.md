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

## Consolidación NANOs InsForge → Winston Servicios

- **SSIW / entrega a pie:** repo externo `~/Proyectos/ssiw` (`ssiw.vercel.app`). Handoff desde este admin en `/ssiw/entrar`. Tablas `registro_salida_pie` y `entregas_alumnos` viven en **Winston Servicios** (`g4ta4bfg`). Cutover Vercel hecho; NANO `winston-ssiw` borrable tras smoke.
- **Boletas:** tablas `boleta_*` + captura en Winston Servicios. Migración: `docs/MIGRACION-BOLETAS-WINSTON.md`. NANO InsForge **Boletas** (`5u3i4tmc`) **eliminado** (2026-09-17); el módulo aún no está en producción operativa.
- **Entersote / gym:** tabla `gym_estado` también en Winston Servicios; app local en PCs (sin repo).
- **Desayunos POS:** tablas `concepto_desayunos`, `pago_desayunos`, `desayunos_saldo`, `notificaciones` en Winston. Migración: `docs/MIGRACION-DESAYUNOS-WINSTON.md`. Apps: `/pos` + repo `~/Proyectos/services`. NANO **Desayunos** (`5g4kw6fw`) borrable **solo tras smoke** OK (Mario).
- **Caja Chica / Monitoreo y Control:** tablas `categories`, `persons`, `executors`, `expenses`, `funds`, etc. en Winston. Migración: `docs/MIGRACION-CAJA-CHICA-WINSTON.md`. App: `~/Proyectos/Cchic` (`cchic.vercel.app`). NANO **Caja Chica** (`fvddcfy5`) borrable cuando Mario lo indique.
- **Cheques:** tablas `ch_cheques`, `ch_cheques_ed`, `ch_cheques_sw`, `ch_cheques_se`, `ch_nombres`, `ch_conceptos`, `ch_subconceptos`, `cheques_banco` en Winston. Migración: `docs/MIGRACION-CHEQUES-WINSTON.md`. App: `~/Proyectos/cheques_new` (`cheques-new.vercel.app`). NANO **Cheques** (`3p3q5w7a`) borrable **solo tras smoke** OK (Mario).
- **Open House / Sesiones Inf.:** tablas `inscripciones`, `sesiones`, `kommo_lead_tracking`, `campamento_verano`, `taller_ia` en Winston. Migración: `docs/MIGRACION-OPEN-HOUSE-WINSTON.md`. App: `~/Proyectos/open_house` (`open-house-chi.vercel.app`). NANO **Open_House** (`ebcv45bg`) borrable **solo tras smoke** OK (Mario).
- **Prórrogas y Ajustes:** app usa Winston (`pago_prorroga` + `alumno` / precios / becas). NANO **Prórrogas y Ajustes** (`nr8dsq6r`) ya eliminable (solo 1 tabla residual).

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
- **Sistema integral boletas:** `/boletas` — 5 módulos activos (Kinder ES/EN, Primaria ES/EN, Secundaria). Auth cookie compartida; envío `POST /api/boletas-envio`.
- **Secundaria:** `/boletas-secundaria` — login maestro/admin, captura, admin, PDF, reportes, email.
- **Kinder / Primaria:** `/boletas/kinder-espanol`, `kinder-ingles`, `primaria-espanol`, `primaria-ingles` — captura + PDF + email.
- **Backend:** tablas `boleta_*` en **Winston Servicios** (`g4ta4bfg`). Env `BOLETAS_INSFORGE_URL` / `BOLETAS_INSFORGE_API_KEY` / `BOLETAS_SESSION_SECRET` (local + Vercel). Migración: `docs/MIGRACION-BOLETAS-WINSTON.md`. NANO InsForge **Boletas** eliminado (2026-09-17); módulo aún no en producción operativa.
- Legacy PHP `winston93.edu.mx/boletas` (y boletasek/ik/español/ingles) convive; no apagar hasta OK de Mario.
