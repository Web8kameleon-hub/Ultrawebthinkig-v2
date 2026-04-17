#!/usr/bin/env bash
set -euo pipefail

# Safe web deploy for Hetzner host.
# - Preserves local server edits with stash
# - Fast-forwards to remote branch
# - Rebuilds only web service
# - Waits until web container is healthy
# - Runs lightweight smoke checks

REPO_DIR="${REPO_DIR:-/root/Clisonix-cloud}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
SERVICE="${SERVICE:-web}"
CONTAINER_NAME="${CONTAINER_NAME:-clisonix-web}"
STASH_MSG="pre-deploy-auto-$(date +%Y%m%d-%H%M%S)"
HEALTH_TIMEOUT_S="${HEALTH_TIMEOUT_S:-120}"

echo "[1/7] Repository: ${REPO_DIR}"
cd "${REPO_DIR}"

echo "[2/7] Creating safety stash for local changes (including untracked)..."
git stash push -u -m "${STASH_MSG}" >/dev/null || true

echo "[3/7] Pulling latest ${REMOTE}/${BRANCH}..."
git pull --ff-only "${REMOTE}" "${BRANCH}"

echo "[4/7] Rebuilding and recreating ${SERVICE} only..."
docker compose up -d --build --no-deps "${SERVICE}"

echo "[5/7] Waiting for ${CONTAINER_NAME} health=healthy (timeout ${HEALTH_TIMEOUT_S}s)..."
start_ts="$(date +%s)"
while true; do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${CONTAINER_NAME}" 2>/dev/null || echo "missing")"
  if [[ "${health}" == "healthy" ]]; then
    break
  fi

  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if (( elapsed >= HEALTH_TIMEOUT_S )); then
    echo "ERROR: ${CONTAINER_NAME} did not become healthy within ${HEALTH_TIMEOUT_S}s (last=${health})."
    docker ps --format '{{.Names}} {{.Status}}' | grep -E "${CONTAINER_NAME}|NAME" || true
    exit 1
  fi

  sleep 2
done

echo "[6/7] Running local smoke checks..."
for url in \
  "http://127.0.0.1:3000/modules" \
  "http://127.0.0.1:3000/robots.txt" \
  "http://127.0.0.1:3000/sitemap.xml" \
  "http://127.0.0.1:3000/api/proxy/kloud-bridge" \
  "http://127.0.0.1:3000/api/proxy/system-metrics"; do
  code="$(curl -s -o /tmp/deploy_smoke_body -w '%{http_code}' -m 20 "${url}" || echo "000")"
  echo "${code} ${url}"
  if [[ "${code}" != "200" ]]; then
    echo "ERROR: Smoke check failed for ${url}"
    head -c 300 /tmp/deploy_smoke_body || true
    echo
    exit 1
  fi
done

echo "[7/7] Done"
echo "Deploy successful."
echo "Latest stashes:"
git stash list | head -n 3 || true
