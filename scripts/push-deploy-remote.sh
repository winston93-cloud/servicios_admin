#!/usr/bin/env bash
# Copia la rama desayunos al repo de deploy (main) para que Vercel actualice.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git remote get-url deploy &>/dev/null; then
  git remote add deploy https://github.com/winston93-cloud/servicios-admin-deploy.git
fi

git push origin desayunos
git push deploy desayunos:main

echo "Listo: desayunos → deploy/main (Vercel)"
