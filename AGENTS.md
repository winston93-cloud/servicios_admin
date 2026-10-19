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

Desde el 5 oct 2026 solo quedan 3 proyectos: **Winston Servicios**, **Reloj Checador** y **Uniformes**; los otros 10 NANOs ya se eliminaron (lo de «borrable» abajo es histórico).

- **SSIW / entrega a pie:** repo externo `~/Proyectos/ssiw` (`ssiw.vercel.app`). Handoff desde este admin en `/ssiw/entrar`. Tablas `registro_salida_pie` y `entregas_alumnos` viven en **Winston Servicios** (`g4ta4bfg`). Cutover Vercel hecho; NANO `winston-ssiw` borrable tras smoke.
- **Boletas:** tablas `boleta_*` + captura en Winston Servicios. Migración: `docs/MIGRACION-BOLETAS-WINSTON.md`. NANO InsForge **Boletas** (`5u3i4tmc`) **eliminado** (2026-09-17); arranca en producción en **noviembre 2026 con el 1er trimestre del ciclo 2026-2027**.
- **Entersote / gym:** tabla `gym_estado` también en Winston Servicios; app local en PCs (sin repo).
- **Desayunos POS:** tablas `concepto_desayunos`, `pago_desayunos`, `desayunos_saldo`, `notificaciones` en Winston. Migración: `docs/MIGRACION-DESAYUNOS-WINSTON.md`. Apps: `/pos` + repo `~/Proyectos/services`. NANO **Desayunos** (`5g4kw6fw`) borrable **solo tras smoke** OK (Mario).
- **Caja Chica / Monitoreo y Control:** tablas `categories`, `persons`, `executors`, `expenses`, `funds`, etc. en Winston. Migración: `docs/MIGRACION-CAJA-CHICA-WINSTON.md`. App: `~/Proyectos/Cchic` (`cchic.vercel.app`). NANO **Caja Chica** (`fvddcfy5`) borrable cuando Mario lo indique.
- **Cheques:** tablas `ch_cheques`, `ch_cheques_ed`, `ch_cheques_sw`, `ch_cheques_se`, `ch_nombres`, `ch_conceptos`, `ch_subconceptos`, `cheques_banco` en Winston. Migración: `docs/MIGRACION-CHEQUES-WINSTON.md`. App: `~/Proyectos/cheques_new` (`cheques-new.vercel.app`). NANO **Cheques** (`3p3q5w7a`) borrable **solo tras smoke** OK (Mario).
- **Open House / Sesiones Inf.:** tablas `inscripciones`, `sesiones`, `kommo_lead_tracking`, `campamento_verano`, `taller_ia` en Winston. Migración: `docs/MIGRACION-OPEN-HOUSE-WINSTON.md`. App: `~/Proyectos/open_house` (`open-house-chi.vercel.app`). NANO **Open_House** (`ebcv45bg`) borrable **solo tras smoke** OK (Mario).
- **AgendaW (admisiones):** tablas `admission_*`, `blocked_dates`, `expediente_inicial`, `tour_recorridos`, `agendaw_wsp` en Winston (2026-10-05). Doc: `docs/AGENDAW_INSFORGE.md`. App: `~/Proyectos/agendaw` (`agendaw.vercel.app`). NANO **AgendaW** (`sr6a9iza`) **eliminado** (2026-10-05); respaldo `~/Respaldos/agendaw-insforge-20261005.sql.gz`.
- **Uniformes:** 43 tablas (`pedidos`, `cotizaciones`, `costos`, `insumos`, `transferencias`, `devoluciones`, `auditoria`, etc.) + bucket privado `datos-fiscales-clientes` en Winston (2026-10-19). Usa `alumno`, `ciclos_escolares` y `usuario` **de Winston** (no se copiaron las suyas). Migración: `docs/MIGRACION-UNIFORMES-WINSTON.md`. App: `~/Proyectos/uniformes`. NANO **Uniformes** (`q488j9fg`) borrable **solo tras smoke** OK (Mario).
- **Prórrogas y Ajustes:** app usa Winston (`pago_prorroga` + `alumno` / precios / becas). NANO **Prórrogas y Ajustes** (`nr8dsq6r`) ya eliminable (solo 1 tabla residual).

## Revisión diaria («Sonny, pendientes»)

La revisión diaria se hace todos los días, haya o no pendientes: está en `revisiones-diarias-servicios-admin.md` (almacén personal de agente de Mario) con el check y la bitácora por día. Los pendientes van aparte en `pendientes-servicios-admin.md` (mismo almacén). Cuando Mario diga «Sonny, pendientes»: correr la revisión del día, anotarla en la bitácora y darle el resumen, y después los pendientes. Esos archivos no van al repo (traen datos de familias).

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
- **Estilos del dashboard principal (`/dashboard`, personal y papás):** selector «Estilo» con distintivo «Nuevo» (`DashboardTemas.tsx`, `dashboard-temas.css`). Por default «Original» (el de siempre); además los 5 de Team English (Kawaii, Acuario, Nave espacial, Diario de campo, Arcade), en claro y oscuro. Se guarda por dispositivo (`servicios-admin-dashboard-tema`). Solo la pantalla de inicio: los 34 sistemas no cambian (decisión de Mario, 15 oct 2026).
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

- Bucket InsForge `cfdi` **privado** (desde 2026-10-03): solo el servidor lee/sube con `INSFORGE_API_KEY`. Papás descargan vía proxy con enlace firmado (`?c=`, `src/lib/cfdi/facturaEnlaceFirmado.ts`) o sesión del portal; personal con su sesión. No volver a hacerlo público.
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
- **Sistema integral boletas:** `/boletas` — 5 módulos activos (Kinder ES/EN, Primaria ES/EN, Secundaria). Auth cookie compartida. **Las boletas nunca se envían por correo** (decisión de Mario): los papás las ven y descargan en `/portal-boletas` cuando la dirección publica; dirección descarga PDF por alumno o grupo. No agregar envío por email en ningún módulo.
- **Secundaria:** maestros capturan en `/boletas-captura/secundaria` (cada uno ve solo sus materias × grupos asignados; hoja tipo Excel con autoguardado; envían por materia + grupo). Dirección en `/boletas-secundaria` (Google `direccion.secundaria@`): entregas y publicación, revisar/corregir, promedios y medallas (Winston/SET truncados como el legacy, lugares por grado y grupo), maestros y asignaciones, materias. Entrega por materia: `boleta_entrega.materia_id` (kinder/primaria = 0). La dirección abre **un** trimestre a captura o la cierra (`boleta_captura_periodo`, sin fila = cerrada); los maestros solo editan el trimestre abierto, la supervisión y la dirección en cualquiera. Lógica en `boletasSecundariaService.ts` / `boletasSecundariaRutas.ts`.
- **Hub `/boletas`:** diseño «Tres puertas» (Superdesign, elegido por Mario): un panel con foto completa por nivel que se abre al señalarlo en PC, ciclo en números de contorno detrás del título, portal de captura en franja, y sello «Publicada» por módulo cuando el trimestre en curso está publicado, desde `/api/boletas-hub` (`boletasHubEstado.ts`; requiere sesión de boletas, sin sesión no se muestra). Animaciones compartidas de los módulos en `src/components/boletas-motion` (librería `motion`, respetan «reducir movimiento»). La entrada de maestros `/boletas-captura` usa el mismo diseño (reusa `boletas-hub.css`).
- **Módulos (los 5 sistemas + portales de captura):** dirección «Boleta Viva» (propuesta C de Grok, elegida por Mario el 14 oct 2026; revisada con TasteSkill v2, `.agents/skills/design-taste-frontend`): la boleta impresa hecha interfaz. Claro: hoja blanca sobre hueso `#faf8f5`, bloques cálidos `#f1ede6`, acento `#1667a8`; oscuro: `#1c222c` sobre `#14181f`, acento `#7ab3e8`. Fraunces en títulos + Nunito Sans en texto (`src/app/boletas/boletasFuentes.ts`, variables `--font-boletas-titulos` / `--font-boletas`). Membrete con escudo por nivel (`MembreteBoleta`: IEW en kinder, WCI en primaria/secundaria), menú de dirección en bloques de dos en dos con ícono arriba, selector E/VG/G/S/NI/U segmentado, renglones alternados, y estados como sellos rotados de borde punteado («Publicada a papás» en rojo). Esquinas suaves (12/18 px); sin degradados, sombras, brillos, vidrio ni etiquetas arriba de los títulos. Colores por grupo A/B/C en Secundaria se conservan. Todo en tokens `--ki-*` de `kinder-ingles.css` + `boletas-modulos-ui.css`; cambiar ahí, no por módulo. Revisión: `node .agents/skills/design-taste-frontend/scripts/lint.mjs <archivos>` debe dar 0 FAIL.
- **Kinder / Primaria:** `/boletas/kinder-espanol`, `kinder-ingles`, `primaria-espanol`, `primaria-ingles` — captura + PDF + email.
- **Backend:** tablas `boleta_*` en **Winston Servicios** (`g4ta4bfg`). Env `BOLETAS_INSFORGE_URL` / `BOLETAS_INSFORGE_API_KEY` / `BOLETAS_SESSION_SECRET` (local + Vercel). Migración: `docs/MIGRACION-BOLETAS-WINSTON.md`. NANO InsForge **Boletas** eliminado (2026-09-17).
- **Arranque:** noviembre 2026, 1er trimestre del ciclo 2026-2027 (decisión de Mario, 12 oct 2026). Antes de eso no hay captura del ciclo nuevo en el sistema nuevo.
- **Portal de papás:** `/portal-boletas` (tarjeta Boletas del dashboard). Solo ciclo actual (`es_actual`); el papá ve un trimestre cuando la coordinación lo publica con «Publicar a papás» en su módulo (tabla `boleta_publicacion`; solo rol admin de boletas). El adeudo no bloquea la boleta (decisión de Mario). Maternal no tiene boleta en portal. Video opcional por ciclo en `boleta_portal_config.video_url`.
- Legacy PHP `winston93.edu.mx/boletas` (y boletasek/ik/español/ingles) convive; no apagar hasta OK de Mario.
