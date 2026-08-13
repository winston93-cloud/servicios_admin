# InsForge proyecto `boletas`

Backend dedicado para **Boletas secundaria** (aparte de Winston Servicios).

## Setup

```bash
# Desde este directorio (no deslinkea Winston Servicios en la raíz del repo)
cd insforge-boletas
npx -y @insforge/cli@latest login
npx -y @insforge/cli@latest create --name boletas   # o link a proyecto existente
npx -y @insforge/cli@latest db query "$(cat migrations/20260813120000_boletas_schema.sql)"
npx -y @insforge/cli@latest db query "$(cat migrations/20260813120100_boletas_seed_catalog.sql)"
```

Import masivo desde MySQL `winston_general` (cuando haya dump/CSV completo):

```bash
node scripts/import-boletas-mysql.mjs --csv-dir ../data/boletas
# o
node scripts/import-boletas-mysql.mjs --mysql-url "$MYSQL_URL"
```

## Secrets en servicios_admin

En `.env.local` / Vercel (solo server):

```
BOLETAS_INSFORGE_URL=https://<project-id>.us-east.insforge.app
BOLETAS_INSFORGE_API_KEY=<anon-or-service-key>
```

El cliente admin del módulo usa la API key con privilegios de escritura; las rutas Next nunca exponen la key al browser.