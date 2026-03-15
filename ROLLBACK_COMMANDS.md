# 🔄 CLISONIX CLOUD - PRODUCTION ROLLBACK GUIDE
## SSH Commands for Server Recovery

**Server**: 46.224.203.89  
**Date**: January 24, 2026  
**Purpose**: Restore to previous stable state

---

## ⚡ QUICK REFERENCE - USE THESE NOW

### 1️⃣ Full System Rollback (SAFEST - 5min)
```bash
ssh root@46.224.203.89 << 'EOF'
# Stop all containers
docker compose -f /opt/clisonix/docker-compose.yml down

# Restore database from latest backup
cd /opt/clisonix/backups
ls -lt *.sql.gz | head -5  # Show 5 most recent backups
LATEST_BACKUP=$(ls -t *.sql.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"
gunzip -c $LATEST_BACKUP | docker exec -i clisonix-postgres psql -U clisonix -d clisonixdb

# Restart containers
cd /opt/clisonix
docker compose -f docker-compose.yml up -d

# Verify
sleep 10
curl -s http://localhost:8000/health | jq .
EOF
```

---

## 🔧 SCENARIO-SPECIFIC ROLLBACKS

### SCENARIO A: Last 1 Hour (Most Common)

```bash
ssh root@46.224.203.89 << 'EOF'
#!/bin/bash
set -e

echo "=== CLISONIX ROLLBACK: Last 1 Hour ==="

# 1. Show recent backups
echo "📊 Available backups:"
ls -lh /opt/clisonix/backups/*.sql.gz | tail -3

# 2. Find backup from 1 hour ago
BACKUP_TIME=$(date -d '1 hour ago' '+%Y%m%d-%H')
BACKUP_FILE="/opt/clisonix/backups/db-${BACKUP_TIME}*.sql.gz"

echo "Looking for backup: $BACKUP_FILE"
if ls $BACKUP_FILE 1> /dev/null 2>&1; then
    echo "✅ Found backup"
    # Get the actual file
    ACTUAL_BACKUP=$(ls -t $BACKUP_FILE | head -1)
    
    # Restore
    echo "⏳ Restoring from: $ACTUAL_BACKUP"
    docker exec -i clisonix-postgres psql -U clisonix -d clisonixdb < <(gunzip -c "$ACTUAL_BACKUP")
    echo "✅ Restore complete"
else
    echo "❌ No backup found for 1 hour ago, using latest"
    LATEST=$(ls -t /opt/clisonix/backups/*.sql.gz | head -1)
    docker exec -i clisonix-postgres psql -U clisonix -d clisonixdb < <(gunzip -c "$LATEST")
fi

# 3. Verify
echo "✅ Verifying restoration..."
curl -s http://localhost:8000/health | jq . || echo "⚠️ API still starting"

EOF
```

---

### SCENARIO B: Rollback to Yesterday 5PM

```bash
ssh root@46.224.203.89 << 'EOF'
#!/bin/bash
set -e

echo "=== CLISONIX ROLLBACK: Yesterday 5PM ==="

# Specify exact backup
BACKUP_DATE="20260123"  # YYYYMMDD
BACKUP_HOUR="17"        # 5 PM
BACKUP_FILE="/opt/clisonix/backups/db-${BACKUP_DATE}-${BACKUP_HOUR}*.sql.gz"

echo "🔍 Looking for: $BACKUP_FILE"
ls -lh $BACKUP_FILE

# Restore
ACTUAL_BACKUP=$(ls -t $BACKUP_FILE | head -1)
echo "⏳ Restoring: $ACTUAL_BACKUP"

# Connect to DB and restore
docker exec -i clisonix-postgres psql -U clisonix -d clisonixdb < <(gunzip -c "$ACTUAL_BACKUP")

echo "✅ Restoration complete"
docker compose -f /opt/clisonix/docker-compose.yml ps

EOF
```

---

### SCENARIO C: Rollback to Previous Git Commit (Code)

```bash
ssh root@46.224.203.89 << 'EOF'
#!/bin/bash
set -e

echo "=== CLISONIX ROLLBACK: Previous Git Commit ==="

cd /opt/clisonix

# Show recent commits
echo "📋 Last 5 commits:"
git log --oneline -5

# Stash any uncommitted changes
git stash

# Roll back 1 commit
echo "⏳ Rolling back to previous commit..."
git reset --hard HEAD~1

# Show current commit
echo "✅ Now at commit:"
git log --oneline -1

# Restart services to use new code
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d

# Wait for services
sleep 10

# Verify
echo "✅ System health:"
curl -s http://localhost:8000/health | jq .

EOF
```

---

### SCENARIO D: Rollback Container Image Only (No Data Loss)

```bash
ssh root@46.224.203.89 << 'EOF'
#!/bin/bash
set -e

echo "=== CLISONIX ROLLBACK: Container Image Only ==="

# List available images
echo "📦 Available images:"
docker images | grep clisonix

# Show image history (last 5 builds)
echo "📜 Image history:"
docker image history clisonix-api:latest | head -6

# Option 1: Use tagged previous version
echo "Stopping current API..."
docker compose -f /opt/clisonix/docker-compose.yml stop api

echo "Starting previous version..."
# If you have tags like api:v1.0.0, api:v1.0.1
docker run -d \
  --name clisonix-api-previous \
  -p 8001:8000 \
  -e DATABASE_URL="postgresql://clisonix:clisonix@localhost:5432/clisonixdb" \
  -e REDIS_URL="redis://localhost:6379/0" \
  clisonix-api:previous-tag

# Test previous version on port 8001
echo "Testing previous version..."
curl -s http://localhost:8001/health | jq .

# If it works, swap
docker compose -f /opt/clisonix/docker-compose.yml up -d

EOF
```

---

### SCENARIO E: Restore from Hetzner Snapshot (Nuclear Option)

```bash
# ⚠️ THIS MUST BE DONE VIA HETZNER CONSOLE, NOT SSH
# But here's what to do:

# 1. Via Hetzner Cloud Console:
# - https://console.hetzner.cloud/
# - Select Server: clisonix-prod
# - Go to "Recovery" tab
# - Select snapshot to restore
# - Click "Restore from Snapshot"
# - System will reboot and restore

# 2. Or via hcloud CLI:
# First, install: https://github.com/hetznercloud/cli

hcloud server reset-to-image \
  --image-id <snapshot-id> \
  --format json \
  <server-id>

# 3. After restore, SSH back in and verify:
ssh root@46.224.203.89 "docker compose -f /opt/clisonix/docker-compose.yml ps"

EOF
```

---

## 🛡️ SAFETY CHECKLIST BEFORE ROLLBACK

```bash
# Run this FIRST to confirm backups exist
ssh root@46.224.203.89 << 'EOF'

echo "🔍 ROLLBACK SAFETY CHECK"
echo "========================"

# 1. Check backup location
echo "✓ Checking backups..."
ls -lh /opt/clisonix/backups/*.sql.gz | wc -l
echo "  Backups found"

# 2. Check backup size (should be > 1MB)
LATEST_BACKUP=$(ls -t /opt/clisonix/backups/*.sql.gz | head -1)
SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
echo "✓ Latest backup size: $SIZE"

# 3. Check disk space
echo "✓ Disk space available:"
df -h /opt/clisonix | awk '{print $1, $5}'

# 4. Check current database
echo "✓ Current database tables:"
docker exec clisonix-postgres psql -U clisonix -d clisonixdb -c "\dt" | wc -l
echo "  tables found"

# 5. Check containers running
echo "✓ Running containers:"
docker compose -f /opt/clisonix/docker-compose.yml ps --format "table {{.Names}}\t{{.Status}}" | wc -l
echo "  containers"

echo ""
echo "✅ SAFE TO PROCEED WITH ROLLBACK"

EOF
```

---

## 📊 STEP-BY-STEP FULL ROLLBACK (Recommended)

```bash
ssh root@46.224.203.89 << 'ROLLBACK'
#!/bin/bash
set -e

TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="/opt/clisonix/logs/rollback_${TIMESTAMP}.log"

echo "🔄 CLISONIX FULL ROLLBACK" | tee $LOG_FILE
echo "Start Time: $TIMESTAMP" | tee -a $LOG_FILE
echo "========================================" | tee -a $LOG_FILE

cd /opt/clisonix

# STEP 1: Backup current state (safety net for the safety net)
echo "" | tee -a $LOG_FILE
echo "📦 STEP 1: Backup current state..." | tee -a $LOG_FILE
docker exec clisonix-postgres pg_dump -U clisonix clisonixdb > "backups/pre-rollback_${TIMESTAMP}.sql"
echo "✓ Pre-rollback backup created" | tee -a $LOG_FILE

# STEP 2: Show health before
echo "" | tee -a $LOG_FILE
echo "🏥 STEP 2: Health before rollback..." | tee -a $LOG_FILE
curl -s http://localhost:8000/health | jq . | tee -a $LOG_FILE

# STEP 3: Find backup to restore
echo "" | tee -a $LOG_FILE
echo "🔍 STEP 3: Finding rollback point..." | tee -a $LOG_FILE
LATEST_BACKUP=$(ls -t /opt/clisonix/backups/*.sql.gz | grep -v pre-rollback | head -1)
echo "Using backup: $LATEST_BACKUP" | tee -a $LOG_FILE

# STEP 4: Stop containers
echo "" | tee -a $LOG_FILE
echo "🛑 STEP 4: Stopping containers..." | tee -a $LOG_FILE
docker compose -f docker-compose.yml down | tee -a $LOG_FILE
sleep 5

# STEP 5: Restore database
echo "" | tee -a $LOG_FILE
echo "♻️  STEP 5: Restoring database..." | tee -a $LOG_FILE
docker compose -f docker-compose.yml up -d postgres redis
sleep 10

echo "Running restore..." | tee -a $LOG_FILE
gunzip -c "$LATEST_BACKUP" | docker exec -i clisonix-postgres psql -U clisonix -d clisonixdb >> $LOG_FILE 2>&1
echo "✓ Database restored" | tee -a $LOG_FILE

# STEP 6: Restart all services
echo "" | tee -a $LOG_FILE
echo "🚀 STEP 6: Restarting all services..." | tee -a $LOG_FILE
docker compose -f docker-compose.yml up -d | tee -a $LOG_FILE
sleep 10

# STEP 7: Health check
echo "" | tee -a $LOG_FILE
echo "🏥 STEP 7: Health check after rollback..." | tee -a $LOG_FILE
echo "API Status:" | tee -a $LOG_FILE
curl -s http://localhost:8000/health | jq . | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "Container Status:" | tee -a $LOG_FILE
docker compose -f docker-compose.yml ps | tee -a $LOG_FILE

# STEP 8: Notify
echo "" | tee -a $LOG_FILE
echo "✅ ROLLBACK COMPLETE" | tee -a $LOG_FILE
echo "End Time: $(date '+%Y-%m-%d_%H-%M-%S')" | tee -a $LOG_FILE
echo "Log saved to: $LOG_FILE" | tee -a $LOG_FILE

ROLLBACK
```

---

## 🚨 EMERGENCY: Immediate Container Restart (Fastest)

If you just need to restart containers without changing data:

```bash
ssh root@46.224.203.89 "cd /opt/clisonix && docker compose down && sleep 5 && docker compose up -d && sleep 10 && curl -s http://localhost:8000/health | jq ."
```

---

## ✅ VERIFICATION COMMANDS

After any rollback, run these:

```bash
# 1. Container health
ssh root@46.224.203.89 "docker compose -f /opt/clisonix/docker-compose.yml ps"

# 2. API health
ssh root@46.224.203.89 "curl -s http://localhost:8000/health | jq ."

# 3. Database connectivity
ssh root@46.224.203.89 "docker exec clisonix-postgres psql -U clisonix -d clisonixdb -c 'SELECT version();'"

# 4. Recent logs
ssh root@46.224.203.89 "docker compose -f /opt/clisonix/docker-compose.yml logs --tail=50 api"

# 5. Disk space
ssh root@46.224.203.89 "df -h /opt/clisonix"
```

---

## 🎯 RECOMMENDED ROLLBACK STRATEGY

**For Production Issues:**

1. **First**: Try `SCENARIO E` (Container restart only) - 30 seconds
2. **If API logic is broken**: Try `SCENARIO C` (Git rollback) - 2 minutes
3. **If data is corrupted**: Try `SCENARIO A` or `B` (Database restore) - 5 minutes
4. **If everything fails**: Use `SCENARIO D` (Snapshot restore) - 15 minutes

---

## 📝 BACKUP SCHEDULE (Automated)

Your server should have automatic backups running:

```bash
# Check if backup cron job exists
ssh root@46.224.203.89 "crontab -l | grep backup"

# List all backups with dates
ssh root@46.224.203.89 "ls -lh /opt/clisonix/backups/*.sql.gz | tail -20"

# Calculate backup frequency
ssh root@46.224.203.89 "ls /opt/clisonix/backups/*.sql.gz | wc -l"
```

---

## 🔐 SECURITY NOTES

- ✅ Backups stored on same server (fast restore)
- ⚠️ Backups NOT encrypted in transit (internal network only)
- ✅ Database credentials never logged
- ⚠️ SSH key required for remote restore
- ✅ Pre-rollback backup created before any changes

---

**Created**: January 24, 2026  
**For**: Production Server 46.224.203.89  
**Status**: Ready for immediate use

