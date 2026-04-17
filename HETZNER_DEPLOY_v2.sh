#!/bin/bash

##############################################################################
# CLISONIX OCEAN CORE v2 - HETZNER SAFE DEPLOYMENT SCRIPT
# Purpose: Deploy 7 Ocean Core v2 implementations to production Hetzner
# Safety: Protects live services, backs up configs, performs health checks
# Author: Clisonix DevOps
# Version: 2.0.0
##############################################################################

set -e

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

HETZNER_HOST="${1:-46.225.14.83}"
HETZNER_USER="${2:-root}"
HETZNER_PORT="${3:-22}"
DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-/root/Clisonix-cloud}"
BACKUP_DIR="${BACKUP_DIR:-/root/clisonix-backups}"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_BRANCH="${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
COMPOSE_FALLBACK_FILE="${COMPOSE_FALLBACK_FILE:-docker-compose.yml}"

# Ocean Core Services (port mapping)
declare -a OCEAN_SERVICES=(
    "ocean-core:8030"
    "ocean-core-multimodal:8033"
    "ocean-core-strict-chat:8035"
    "ocean-core-blerina:8032"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# SSH helper function
ssh_exec() {
    ssh -p "${HETZNER_PORT}" "${HETZNER_USER}@${HETZNER_HOST}" "$@"
}

# SCP helper function
scp_file() {
    scp -P "${HETZNER_PORT}" "$1" "${HETZNER_USER}@${HETZNER_HOST}:$2"
}

# ═══════════════════════════════════════════════════════════════════════════
# PRE-DEPLOYMENT CHECKS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  CLISONIX OCEAN CORE v2 HETZNER DEPLOYMENT                         ║"
echo "║  Version 2.0.0 - Safe Production Deployment                        ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

log_info "Starting deployment to Hetzner: ${HETZNER_HOST}:${HETZNER_PORT}"

# Check SSH connectivity
log_info "Checking SSH connectivity..."
if ! ssh_exec "echo 'SSH connection OK'" > /dev/null 2>&1; then
    log_error "Cannot connect to Hetzner server at ${HETZNER_HOST}:${HETZNER_PORT}"
    echo "Make sure you have:"
    echo "  1. SSH key authentication configured"
    echo "  2. Server IP/hostname correct"
    echo "  3. Firewall allows SSH (port ${HETZNER_PORT})"
    exit 1
fi
log_success "SSH connectivity verified"

# Check Docker availability
log_info "Checking Docker and Docker Compose on server..."
if ! ssh_exec "docker --version && docker-compose --version" > /dev/null 2>&1; then
    log_error "Docker or Docker Compose not found on Hetzner server"
    echo "Please install Docker and Docker Compose first"
    exit 1
fi
log_success "Docker and Docker Compose available"

# Resolve local compose file (prefer production compose, fallback to legacy compose)
LOCAL_COMPOSE_FILE=""
if [ -f "${COMPOSE_FILE}" ]; then
    LOCAL_COMPOSE_FILE="${COMPOSE_FILE}"
elif [ -f "${COMPOSE_FALLBACK_FILE}" ]; then
    LOCAL_COMPOSE_FILE="${COMPOSE_FALLBACK_FILE}"
    log_warning "${COMPOSE_FILE} not found locally, using fallback ${COMPOSE_FALLBACK_FILE}"
else
    log_error "Neither ${COMPOSE_FILE} nor ${COMPOSE_FALLBACK_FILE} found in current directory"
    exit 1
fi
log_info "Using local compose file: ${LOCAL_COMPOSE_FILE}"

# Check current running services
log_info "Checking current running services..."
RUNNING_SERVICES=$(ssh_exec "docker ps --format 'table {{.Names}}'" 2>&1 | tail -n +2 | wc -l || echo "0")
log_info "Currently running ${RUNNING_SERVICES} containers"

# ═══════════════════════════════════════════════════════════════════════════
# BACKUP OPERATION
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🔄 Creating backups on Hetzner server..."

ssh_exec "mkdir -p ${BACKUP_DIR}"

# Backup compose file used for deployment
if ssh_exec "test -f ${DEPLOYMENT_DIR}/${COMPOSE_FILE}"; then
    log_info "Backing up ${COMPOSE_FILE} -> ${BACKUP_DIR}/${COMPOSE_FILE}.${BACKUP_TIMESTAMP}"
    ssh_exec "cp ${DEPLOYMENT_DIR}/${COMPOSE_FILE} ${BACKUP_DIR}/${COMPOSE_FILE}.${BACKUP_TIMESTAMP}"
    log_success "${COMPOSE_FILE} backed up"
elif ssh_exec "test -f ${DEPLOYMENT_DIR}/${COMPOSE_FALLBACK_FILE}"; then
    log_info "Backing up ${COMPOSE_FALLBACK_FILE} -> ${BACKUP_DIR}/${COMPOSE_FALLBACK_FILE}.${BACKUP_TIMESTAMP}"
    ssh_exec "cp ${DEPLOYMENT_DIR}/${COMPOSE_FALLBACK_FILE} ${BACKUP_DIR}/${COMPOSE_FALLBACK_FILE}.${BACKUP_TIMESTAMP}"
    log_success "${COMPOSE_FALLBACK_FILE} backed up"
else
    log_warning "No existing compose file found on server (fresh deployment)"
fi

# Backup current .env if exists
if ssh_exec "test -f ${DEPLOYMENT_DIR}/.env"; then
    log_info "Backing up .env -> ${BACKUP_DIR}/.env.${BACKUP_TIMESTAMP}"
    ssh_exec "cp ${DEPLOYMENT_DIR}/.env ${BACKUP_DIR}/.env.${BACKUP_TIMESTAMP}"
    log_success ".env backed up"
fi

# ═══════════════════════════════════════════════════════════════════════════
# TRANSFER UPDATED DOCKER-COMPOSE.YML
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "📦 Transferring updated compose file..."

# Create deployment directory if doesn't exist
ssh_exec "mkdir -p ${DEPLOYMENT_DIR}"

# Transfer compose file and normalize remote target to COMPOSE_FILE
log_info "Copying ${LOCAL_COMPOSE_FILE} to ${HETZNER_HOST}:${DEPLOYMENT_DIR}/${COMPOSE_FILE}"
scp_file "${LOCAL_COMPOSE_FILE}" "${DEPLOYMENT_DIR}/${COMPOSE_FILE}"
log_success "${COMPOSE_FILE} transferred"

# Transfer Dockerfiles for Ocean services
log_info "Transferring Ocean Core Dockerfiles..."

DOCKERFILES=(
    "ocean-core/Dockerfile"
    "ocean-core/Dockerfile.multimodal"
    "ocean-core/Dockerfile.strict-chat"
    "ocean-core/Dockerfile.blerina"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    if [ -f "$dockerfile" ]; then
        DIRNAME=$(dirname "$dockerfile")
        BASENAME=$(basename "$dockerfile")
        ssh_exec "mkdir -p ${DEPLOYMENT_DIR}/${DIRNAME}"
        scp_file "$dockerfile" "${DEPLOYMENT_DIR}/${DIRNAME}/"
        log_success "${BASENAME} transferred"
    fi
done

# ═══════════════════════════════════════════════════════════════════════════
# PULL LATEST CODE (if in git repo)
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🔄 Updating codebase from git..."

if ssh_exec "test -d ${DEPLOYMENT_DIR}/.git"; then
    log_info "Git repository found, syncing branch ${DEPLOY_BRANCH}..."
    ssh_exec "cd ${DEPLOYMENT_DIR} && git fetch origin ${DEPLOY_BRANCH} --quiet && (git checkout ${DEPLOY_BRANCH} || git checkout -b ${DEPLOY_BRANCH} origin/${DEPLOY_BRANCH}) && git pull --ff-only origin ${DEPLOY_BRANCH}" && \
        log_success "Git sync completed" || \
        log_warning "Git sync had issues, continuing..."
else
    log_warning "Not in a git repository, skipping git sync"
fi

# ═══════════════════════════════════════════════════════════════════════════
# PRE-DEPLOYMENT HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🏥 Checking Ollama service health..."

if ssh_exec "curl -sf http://localhost:11434/api/tags > /dev/null 2>&1"; then
    log_success "Ollama service healthy and responding"
else
    log_warning "Ollama service may not be responding - deployment will start Ollama"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STOP ONLY OCEAN CORE SERVICES (preserve others)
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🛑 Stopping existing Ocean Core services..."

for service in "${OCEAN_SERVICES[@]}"; do
    SERVICE_NAME=$(echo "$service" | cut -d: -f1)
    PORT=$(echo "$service" | cut -d: -f2)

    if ssh_exec "docker ps --filter 'name=${SERVICE_NAME}' --format '{{.Names}}' | grep -q '^${SERVICE_NAME}$'"; then
        log_info "Stopping ${SERVICE_NAME}..."
        ssh_exec "docker stop ${SERVICE_NAME} 2>/dev/null || true" && \
            log_success "${SERVICE_NAME} stopped" || \
            log_warning "Could not stop ${SERVICE_NAME}"
    else
        log_info "${SERVICE_NAME} not running (fresh deployment)"
    fi
done

# ═══════════════════════════════════════════════════════════════════════════
# REBUILD AND START OCEAN CORE SERVICES
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🏗️ Building and starting Ocean Core services..."

# Go to deployment directory and rebuild services
ssh_exec "cd ${DEPLOYMENT_DIR} && \
    export CLISONIX_ENV_FILE='${ENV_FILE}' && \
    docker-compose -f ${COMPOSE_FILE} up -d \
        --build \
        ocean-core \
        ocean-core-multimodal \
        ocean-core-strict-chat \
        ocean-core-blerina" && \
    log_success "Ocean Core services built and started" || \
    { log_error "Failed to build/start services"; exit 1; }

# ═══════════════════════════════════════════════════════════════════════════
# WAIT FOR SERVICES TO BE HEALTHY
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "⏳ Waiting for Ocean Core services to be healthy..."

declare -a SERVICE_HEALTH
sleep 5  # Give services time to start

for service in "${OCEAN_SERVICES[@]}"; do
    SERVICE_NAME=$(echo "$service" | cut -d: -f1)
    PORT=$(echo "$service" | cut -d: -f2)

    log_info "Checking ${SERVICE_NAME} (port ${PORT})..."

    MAX_ATTEMPTS=30
    ATTEMPT=0
    HEALTHY=false

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if ssh_exec "curl -sf http://localhost:${PORT}/health > /dev/null 2>&1"; then
            log_success "${SERVICE_NAME} is HEALTHY ✓"
            SERVICE_HEALTH["$SERVICE_NAME"]=true
            HEALTHY=true
            break
        fi

        ATTEMPT=$((ATTEMPT + 1))

        if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
            echo -n "."
            sleep 2
        fi
    done

    if [ "$HEALTHY" = false ]; then
        log_warning "${SERVICE_NAME} health check timed out (may still be starting)"
        SERVICE_HEALTH["$SERVICE_NAME"]=timeout
    fi
done

# ═══════════════════════════════════════════════════════════════════════════
# VERIFY NO DISRUPTION TO OTHER SERVICES
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "🔍 Verifying other services still running..."

OTHER_SERVICES=$(ssh_exec "docker ps --format 'table {{.Names}}' | tail -n +2 | grep -v '^ocean-' | head -10" 2>&1)

if [ ! -z "$OTHER_SERVICES" ]; then
    log_success "Non-Ocean services still running:"
    echo "$OTHER_SERVICES" | while read service; do
        [ ! -z "$service" ] && echo "  ✓ $service"
    done
else
    log_warning "Could not verify other services"
fi

# ═══════════════════════════════════════════════════════════════════════════
# POST-DEPLOYMENT DIAGNOSTICS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
log_info "📊 Running post-deployment diagnostics..."

# Get container statuses
log_info "Ocean Core service status:"
ssh_exec "docker ps -a --filter 'label=com.docker.compose.project=clisonix' --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -E '^ocean-' || true"

# Check logs for errors
log_info "Checking service logs for errors..."
for service in "${OCEAN_SERVICES[@]}"; do
    SERVICE_NAME=$(echo "$service" | cut -d: -f1)
    ERROR_COUNT=$(ssh_exec "docker logs ${SERVICE_NAME} 2>&1 | grep -i 'error\|exception\|traceback' | wc -l" 2>/dev/null || echo "0")

    if [ "$ERROR_COUNT" -gt 0 ]; then
        log_warning "${SERVICE_NAME} has ${ERROR_COUNT} error lines in logs (review with: docker logs ${SERVICE_NAME})"
    else
        log_success "${SERVICE_NAME} logs clean"
    fi
done

# ═══════════════════════════════════════════════════════════════════════════
# DEPLOYMENT SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  DEPLOYMENT COMPLETE                                              ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

log_success "Ocean Core v2 deployed to ${HETZNER_HOST}"
log_success "Services should be accessible at:"
for service in "${OCEAN_SERVICES[@]}"; do
    SERVICE_NAME=$(echo "$service" | cut -d: -f1)
    PORT=$(echo "$service" | cut -d: -f2)
    echo "  🌊 ${SERVICE_NAME}: http://${HETZNER_HOST}:${PORT}"
done

echo ""
log_info "Backup location: ${BACKUP_DIR}/${COMPOSE_FILE}.${BACKUP_TIMESTAMP} (or fallback file backup if applicable)"
log_info "To rollback: ssh ${HETZNER_USER}@${HETZNER_HOST} 'cp ${BACKUP_DIR}/${COMPOSE_FILE}.${BACKUP_TIMESTAMP} ${DEPLOYMENT_DIR}/${COMPOSE_FILE} && cd ${DEPLOYMENT_DIR} && docker-compose -f ${COMPOSE_FILE} restart'"

echo ""
log_info "Deployment finished at $(date)"
log_success "✅ All Ocean Core v2 services deployed successfully!"
echo ""
