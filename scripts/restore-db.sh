#!/bin/bash
# Database restore script for Iranian VPS deployment

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.gz>"
    echo "Example: $0 /opt/novax-price-alert/backups/novax_backup_20260604_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🇮🇷 Starting database restore from: $BACKUP_FILE"

# Decompress backup to temporary file
TEMP_SQL="/tmp/restore_$(date +%s).sql"
echo "Decompressing backup..."
gunzip -c "$BACKUP_FILE" > $TEMP_SQL

# Confirm restore
read -p "This will replace the current database. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    rm -f $TEMP_SQL
    exit 0
fi

# Restore database
echo "Restoring database..."
docker compose -f /opt/novax-price-alert/docker-compose.ir-vps.yml exec -T postgres psql -U novax novax_price_alert < $TEMP_SQL

# Cleanup
rm -f $TEMP_SQL

echo "✓ Database restore completed successfully!"
echo "Please restart the API and worker services:"
echo "docker compose -f /opt/novax-price-alert/docker-compose.ir-vps.yml restart api worker"
