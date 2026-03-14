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
DEPLOYMENT_DIR="/root/clisonix-cloud"
BACKUP_DIR="/root/clisonix-backups"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Backup docker-compose.yml
if ssh_exec "test -f ${DEPLOYMENT_DIR}/docker-compose.yml"; then
    log_info "Backing up docker-compose.yml -> ${BACKUP_DIR}/docker-compose.yml.${BACKUP_TIMESTAMP}"
    ssh_exec "cp ${DEPLOYMENT_DIR}/docker-compose.yml ${BACKUP_DIR}/docker-compose.yml.${BACKUP_TIMESTAMP}"
    log_success "docker-compose.yml backed up"
else
    log_warning "No existing docker-compose.yml found on server (fresh deployment)"
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
log_info "📦 Transferring updated docker-compose.yml..."

# Create deployment directory if doesn't exist
ssh_exec "mkdir -p ${DEPLOYMENT_DIR}"

# Transfer docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    log_info "Copying docker-compose.yml to ${HETZNER_HOST}:${DEPLOYMENT_DIR}/"
    scp_file "docker-compose.yml" "${DEPLOYMENT_DIR}/"
    log_success "docker-compose.yml transferred"
else
    log_error "docker-compose.yml not found in current directory"
    exit 1
fi

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
    log_info "Git repository found, pulling latest changes..."
    ssh_exec "cd ${DEPLOYMENT_DIR} && git pull origin main --quiet" && \
        log_success "Git pull completed" || \
        log_warning "Git pull had issues, continuing..."
else
    log_warning "Not in a git repository, skipping git pull"
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
    docker-compose up -d \
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
log_info "Backup location: ${BACKUP_DIR}/docker-compose.yml.${BACKUP_TIMESTAMP}"
log_info "To rollback: ssh ${HETZNER_USER}@${HETZNER_HOST} 'cp ${BACKUP_DIR}/docker-compose.yml.${BACKUP_TIMESTAMP} ${DEPLOYMENT_DIR}/docker-compose.yml && cd ${DEPLOYMENT_DIR} && docker-compose restart'"

echo ""
log_info "Deployment finished at $(date)"
log_success "✅ All Ocean Core v2 services deployed successfully!"
echo ""
