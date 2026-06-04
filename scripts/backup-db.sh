#!/bin/bash
# Database backup script for Iranian VPS deployment

set -e

BACKUP_DIR="/opt/novax-price-alert/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/novax_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo "🇮🇷 Starting database backup..."

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

# Backup database
echo "Dumping PostgreSQL database..."
docker compose -f /opt/novax-price-alert/docker-compose.ir-vps.yml exec -T postgres pg_dump -U novax novax_price_alert > ${BACKUP_FILE}

# Compress backup
echo "Compressing backup..."
gzip ${BACKUP_FILE}

# Get file size
FILE_SIZE=$(du -h ${COMPRESSED_FILE} | cut -f1)

echo "✓ Backup completed: ${COMPRESSED_FILE} (${FILE_SIZE})"

# Keep only last 7 days
echo "Cleaning old backups (keeping last 7 days)..."
find ${BACKUP_DIR} -name "novax_backup_*.sql.gz" -mtime +7 -delete

# List remaining backups
echo "Current backups:"
ls -lh ${BACKUP_DIR}/novax_backup_*.sql.gz

echo "Backup process finished successfully!"
