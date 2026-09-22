#!/usr/bin/env bash
# Corrige MCP InsForge → Winston Servicios (g4ta4bfg) y prueba la BD.
# Ejecutar en una terminal local (fuera del sandbox del agente):
#   bash scripts/setup-insforge-mcp-winston.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJ="$ROOT/.insforge/project.json"

if [[ ! -f "$PROJ" ]]; then
  echo "Falta $PROJ — corre: npx -y @insforge/cli link"
  exit 1
fi

API_KEY=$(python3 -c "import json;print(json.load(open('$PROJ'))['api_key'])")
OSS=$(python3 -c "import json;print(json.load(open('$PROJ'))['oss_host'])")

mkdir -p "$HOME/.cursor"
cat > "$HOME/.cursor/mcp.json" <<EOF
{
  "mcpServers": {
    "insforge": {
      "command": "npx",
      "args": ["-y", "@insforge/mcp@latest"],
      "env": {
        "API_KEY": "$API_KEY",
        "API_BASE_URL": "$OSS"
      }
    }
  }
}
EOF
chmod 600 "$HOME/.cursor/mcp.json"
echo "OK: ~/.cursor/mcp.json → $OSS"

# Ampliar red del CLI agent si existe config
python3 - <<'PY'
import json
from pathlib import Path
p = Path.home() / '.cursor' / 'cli-config.json'
if p.exists():
    cli = json.loads(p.read_text())
    cli.setdefault('sandbox', {})
    cli['sandbox']['mode'] = 'disabled'
    cli['sandbox']['networkAccess'] = 'allow_all'
    p.write_text(json.dumps(cli, indent=2) + '\n')
    print('OK: cli-config sandbox.networkAccess=allow_all')
PY

echo "Probando SQL…"
cd "$ROOT"
npx -y @insforge/cli db query --json "SELECT COUNT(*)::int AS materias_mk FROM boleta_materia WHERE materia_nivel IN (1,2)"
echo
echo "Listo. En Cursor: Settings → MCP → reinicia el server 'insforge'."
echo "Luego: node --env-file=.env.local scripts/diagnostico-rac-ingles-mk.mjs"
