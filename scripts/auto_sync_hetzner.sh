#!/usr/bin/env bash
set -euo pipefail

# Auto chain: commit -> push -> remote pull -> full rebuild -> unhealthy report
# Usage:
#   scripts/auto_sync_hetzner.sh "your commit message"
# Env overrides:
#   REMOTE_HOST=hetzner-new
#   REMOTE_DIR=/root/Clisonix-cloud
#   BRANCH=main
#   COMPOSE_FILE=docker-compose.yml

REMOTE_HOST="${REMOTE_HOST:-hetzner-new}"
REMOTE_DIR="${REMOTE_DIR:-/root/Clisonix-cloud}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if ! command -v git >/dev/null 2>&1; then
  echo "❌ git is required"
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "❌ ssh is required"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌ run this script from inside the repository"
  exit 1
fi

COMMIT_MESSAGE="${1:-auto: sync and rebuild}"

CHANGED_FILES="$(git status --porcelain)"
if [[ -n "$CHANGED_FILES" ]]; then
  echo "📝 Staging and committing local changes..."
  git add -A
  git commit -m "$COMMIT_MESSAGE"
else
  echo "ℹ️ No local changes to commit. Continuing with push/deploy."
fi

echo "⬆️ Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo "🚀 Running remote sync + full rebuild on $REMOTE_HOST..."
ssh "$REMOTE_HOST" "set -euo pipefail; \
  if [ -d '$REMOTE_DIR' ]; then cd '$REMOTE_DIR'; \
  elif [ -d '/opt/clisonix-cloud/current' ]; then cd '/opt/clisonix-cloud/current'; \
  elif [ -d '/root/Clisonix-cloud' ]; then cd '/root/Clisonix-cloud'; \
  else echo '❌ Remote repo directory not found'; exit 1; fi; \
  git fetch origin '$BRANCH'; \
  git checkout '$BRANCH'; \
  git reset --hard 'origin/$BRANCH'; \
  docker compose -f '$COMPOSE_FILE' up -d --build --remove-orphans; \
  echo '--- Unhealthy containers (if any) ---'; \
  docker ps --filter 'health=unhealthy' --format '{{.Names}}\\t{{.Status}}'"

UNHEALTHY_OUTPUT="$(ssh "$REMOTE_HOST" "docker ps --filter 'health=unhealthy' --format '{{.Names}}'")"
if [[ -n "$UNHEALTHY_OUTPUT" ]]; then
  echo "❌ Deployment completed but unhealthy containers remain:"
  echo "$UNHEALTHY_OUTPUT"
  exit 2
fi

echo "✅ Auto sync completed: commit/push/rebuild finished and no unhealthy containers detected."
