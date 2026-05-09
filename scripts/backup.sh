#!/bin/bash
#
# Script de Backup - Sistema Editorial EDITIA
# Uso: ./scripts/backup.sh [local|remote|restore]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/opt/editorial-workflow/backups"
MAX_BACKUPS=7
DATE=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sistema de Backup - EDITIA           ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Local backup
backup_local() {
    BACKUP_PATH="$BACKUP_DIR/backup_$DATE"
    mkdir -p "$BACKUP_PATH"

    echo -e "${BLUE}[1/4] Respaldando Redis...${NC}"
    docker compose exec -T redis redis-cli BGSAVE 2>/dev/null || true
    sleep 2
    docker cp editorial-redis:/data/dump.rdb "$BACKUP_PATH/redis-dump.rdb" 2>/dev/null || echo "Redis backup skipped"

    echo -e "${BLUE}[2/4] Respaldando configuración...${NC}"
    cp .env "$BACKUP_PATH/.env.backup" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_PATH/" 2>/dev/null || true
    cp -r nginx "$BACKUP_PATH/" 2>/dev/null || true
    cp -r monitoring "$BACKUP_PATH/" 2>/dev/null || true

    echo -e "${BLUE}[3/4] Respaldando Grafana...${NC}"
    docker cp editorial-grafana:/var/lib/grafana "$BACKUP_PATH/grafana-data" 2>/dev/null || echo "Grafana backup skipped"

    echo -e "${BLUE}[4/4] Comprimiendo backup...${NC}"
    tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "backup_$DATE"
    rm -rf "$BACKUP_PATH"

    # Cleanup old backups
    echo -e "${BLUE}Limpiando backups antiguos...${NC}"
    ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

    # Show backup info
    BACKUP_SIZE=$(du -h "$BACKUP_PATH.tar.gz" | cut -f1)
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Backup Completado!                    ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "Archivo: ${GREEN}$BACKUP_PATH.tar.gz${NC}"
    echo -e "Tamaño:  ${GREEN}$BACKUP_SIZE${NC}"
    echo ""
    echo -e "Backups disponibles:"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -5
}

# Remote backup (to another server or S3)
backup_remote() {
    echo -e "${BLUE}Creando backup local primero...${NC}"
    backup_local

    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz | head -1)

    if [ -n "$BACKUP_REMOTE_HOST" ] && [ -n "$BACKUP_REMOTE_PATH" ]; then
        echo -e "${BLUE}Enviando a servidor remoto...${NC}"
        scp "$LATEST_BACKUP" "$BACKUP_REMOTE_HOST:$BACKUP_REMOTE_PATH/"
        echo -e "${GREEN}Backup enviado a $BACKUP_REMOTE_HOST${NC}"
    elif [ -n "$AWS_S3_BUCKET" ]; then
        echo -e "${BLUE}Subiendo a S3...${NC}"
        aws s3 cp "$LATEST_BACKUP" "s3://$AWS_S3_BUCKET/backups/"
        echo -e "${GREEN}Backup subido a S3${NC}"
    else
        echo -e "${YELLOW}Backup remoto no configurado.${NC}"
        echo ""
        echo "Para habilitar backup remoto, configure:"
        echo "  - BACKUP_REMOTE_HOST y BACKUP_REMOTE_PATH (para SCP)"
        echo "  - O AWS_S3_BUCKET (para S3)"
    fi
}

# Restore from backup
restore() {
    echo -e "${BLUE}Backups disponibles:${NC}"
    echo ""

    BACKUPS=($(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null))

    if [ ${#BACKUPS[@]} -eq 0 ]; then
        echo -e "${RED}No hay backups disponibles${NC}"
        exit 1
    fi

    for i in "${!BACKUPS[@]}"; do
        SIZE=$(du -h "${BACKUPS[$i]}" | cut -f1)
        DATE=$(basename "${BACKUPS[$i]}" .tar.gz | sed 's/backup_//')
        echo "  [$i] $DATE ($SIZE)"
    done

    echo ""
    read -p "Seleccione backup a restaurar [0-$((${#BACKUPS[@]}-1))]: " SELECTION

    if [ -z "$SELECTION" ] || [ "$SELECTION" -ge ${#BACKUPS[@]} ]; then
        echo -e "${RED}Selección inválida${NC}"
        exit 1
    fi

    SELECTED_BACKUP="${BACKUPS[$SELECTION]}"

    echo ""
    echo -e "${YELLOW}ADVERTENCIA: Esto sobrescribirá los datos actuales.${NC}"
    read -p "¿Está seguro? (escriba 'SI' para confirmar): " CONFIRM

    if [ "$CONFIRM" != "SI" ]; then
        echo "Restauración cancelada."
        exit 0
    fi

    echo ""
    echo -e "${BLUE}Restaurando desde: $SELECTED_BACKUP${NC}"

    # Extract backup
    RESTORE_DIR="$BACKUP_DIR/restore_temp"
    mkdir -p "$RESTORE_DIR"
    tar -xzf "$SELECTED_BACKUP" -C "$RESTORE_DIR"

    BACKUP_CONTENT=$(ls "$RESTORE_DIR")

    # Stop services
    echo -e "${BLUE}Deteniendo servicios...${NC}"
    docker compose down

    # Restore Redis
    if [ -f "$RESTORE_DIR/$BACKUP_CONTENT/redis-dump.rdb" ]; then
        echo -e "${BLUE}Restaurando Redis...${NC}"
        docker compose up -d redis
        sleep 2
        docker cp "$RESTORE_DIR/$BACKUP_CONTENT/redis-dump.rdb" editorial-redis:/data/dump.rdb
        docker compose restart redis
    fi

    # Restore config
    if [ -f "$RESTORE_DIR/$BACKUP_CONTENT/.env.backup" ]; then
        echo -e "${BLUE}Restaurando configuración...${NC}"
        cp "$RESTORE_DIR/$BACKUP_CONTENT/.env.backup" .env
    fi

    # Restore Grafana
    if [ -d "$RESTORE_DIR/$BACKUP_CONTENT/grafana-data" ]; then
        echo -e "${BLUE}Restaurando Grafana...${NC}"
        docker compose up -d grafana
        sleep 2
        docker cp "$RESTORE_DIR/$BACKUP_CONTENT/grafana-data" editorial-grafana:/var/lib/grafana
        docker compose restart grafana
    fi

    # Cleanup
    rm -rf "$RESTORE_DIR"

    # Start all services
    echo -e "${BLUE}Iniciando servicios...${NC}"
    docker compose up -d

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Restauración Completada!              ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    docker compose ps
}

# List backups
list_backups() {
    echo -e "${BLUE}Backups disponibles:${NC}"
    echo ""

    if ls "$BACKUP_DIR"/*.tar.gz 1> /dev/null 2>&1; then
        for backup in $(ls -t "$BACKUP_DIR"/*.tar.gz); do
            SIZE=$(du -h "$backup" | cut -f1)
            NAME=$(basename "$backup")
            echo "  - $NAME ($SIZE)"
        done
    else
        echo "  No hay backups disponibles"
    fi
    echo ""
}

# Show help
show_help() {
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  local    - Crear backup local"
    echo "  remote   - Crear backup y enviar a servidor remoto/S3"
    echo "  restore  - Restaurar desde un backup"
    echo "  list     - Listar backups disponibles"
    echo "  help     - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 local"
    echo "  $0 restore"
    echo ""
}

# Main
cd /opt/editorial-workflow 2>/dev/null || cd "$(dirname "$0")/.."

case "${1:-local}" in
    local)
        backup_local
        ;;
    remote)
        backup_remote
        ;;
    restore)
        restore
        ;;
    list)
        list_backups
        ;;
    help|*)
        show_help
        ;;
esac
