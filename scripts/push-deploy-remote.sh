#!/usr/bin/env bash
# Sincroniza desayunos → carpeta deploy y opcionalmente empuja a un remoto (p. ej. Vercel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$ROOT/../servicios_admin_deploy}"
BRANCH="${BRANCH:-desayunos}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
DEPLOY_REMOTE="${1:-https://github.com/winston93-cloud/servicios-admin-deploy.git}"

if [[ ! -d "$DEPLOY_DIR/.git" ]]; then
  git clone --branch "$BRANCH" --single-branch "$ROOT" "$DEPLOY_DIR"
  git -C "$DEPLOY_DIR" remote rename origin upstream 2>/dev/null || true
fi

git -C "$DEPLOY_DIR" fetch "$ROOT" "$BRANCH"
git -C "$DEPLOY_DIR" checkout "$BRANCH"
git -C "$DEPLOY_DIR" reset --hard "FETCH_HEAD"

if [[ -n "$DEPLOY_REMOTE" ]]; then
  if git -C "$DEPLOY_DIR" remote get-url origin &>/dev/null; then
    git -C "$DEPLOY_DIR" remote set-url origin "$DEPLOY_REMOTE"
  else
    git -C "$DEPLOY_DIR" remote add origin "$DEPLOY_REMOTE"
  fi
  git -C "$DEPLOY_DIR" push -u origin "${BRANCH}:${TARGET_BRANCH}" --force
  echo "Listo: ${BRANCH} → origin/${TARGET_BRANCH} en ${DEPLOY_REMOTE}"
else
  echo "Sincronizado en ${DEPLOY_DIR} (sin push; pase URL del remoto como argumento)."
fi
