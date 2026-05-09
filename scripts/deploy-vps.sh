#!/bin/bash
#
# Script de Despliegue para VPS - Sistema Editorial EDITIA
# Uso: ./scripts/deploy-vps.sh [install|start|stop|restart|update|logs|status]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="editorial-workflow"
COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sistema Editorial EDITIA - VPS Deploy ${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker no está instalado${NC}"
        echo "Instale Docker con: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Error: Docker Compose no está instalado${NC}"
        exit 1
    fi
}

# Check environment file
check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}Archivo .env no encontrado. Creando desde .env.example...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}Archivo .env creado. Por favor, configure las variables antes de continuar.${NC}"
            echo -e "${YELLOW}Edite el archivo con: nano .env${NC}"
            exit 1
        else
            echo -e "${RED}Error: .env.example no encontrado${NC}"
            exit 1
        fi
    fi
}

# Install/Setup
install() {
    echo -e "${BLUE}Instalando sistema...${NC}"

    check_docker
    check_env

    # Create necessary directories
    mkdir -p nginx/ssl nginx/logs

    # Build images
    echo -e "${BLUE}Construyendo imágenes Docker...${NC}"
    docker compose build --no-cache

    echo -e "${GREEN}Instalación completada!${NC}"
    echo -e "${YELLOW}Ejecute './scripts/deploy-vps.sh start' para iniciar${NC}"
}

# Start services
start() {
    echo -e "${BLUE}Iniciando servicios...${NC}"
    check_env

    docker compose up -d

    echo -e "${GREEN}Servicios iniciados!${NC}"
    echo ""
    echo -e "Aplicación: ${GREEN}http://localhost:3000${NC}"
    echo -e "Grafana:    ${GREEN}http://localhost:3001${NC} (admin / ver .env)"
    echo -e "Prometheus: ${GREEN}http://localhost:9090${NC}"
}

# Start with Nginx (production)
start_production() {
    echo -e "${BLUE}Iniciando servicios en modo producción...${NC}"
    check_env

    docker compose --profile production up -d

    echo -e "${GREEN}Servicios iniciados en modo producción!${NC}"
    echo -e "La aplicación está disponible en el puerto 80"
}

# Stop services
stop() {
    echo -e "${BLUE}Deteniendo servicios...${NC}"
    docker compose down
    echo -e "${GREEN}Servicios detenidos${NC}"
}

# Restart services
restart() {
    echo -e "${BLUE}Reiniciando servicios...${NC}"
    docker compose restart
    echo -e "${GREEN}Servicios reiniciados${NC}"
}

# Update application
update() {
    echo -e "${BLUE}Actualizando aplicación...${NC}"

    # Pull latest code (if using git)
    if [ -d ".git" ]; then
        echo -e "${BLUE}Obteniendo últimos cambios...${NC}"
        git pull origin main
    fi

    # Rebuild and restart
    echo -e "${BLUE}Reconstruyendo imágenes...${NC}"
    docker compose build app

    echo -e "${BLUE}Reiniciando aplicación...${NC}"
    docker compose up -d app

    echo -e "${GREEN}Actualización completada!${NC}"
}

# Show logs
logs() {
    SERVICE=${2:-""}
    if [ -z "$SERVICE" ]; then
        docker compose logs -f --tail=100
    else
        docker compose logs -f --tail=100 "$SERVICE"
    fi
}

# Show status
status() {
    echo -e "${BLUE}Estado de los servicios:${NC}"
    echo ""
    docker compose ps
    echo ""

    # Check health
    echo -e "${BLUE}Health checks:${NC}"

    # App health
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "App:        ${GREEN}OK${NC}"
    else
        echo -e "App:        ${RED}ERROR${NC}"
    fi

    # Redis health
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "Redis:      ${GREEN}OK${NC}"
    else
        echo -e "Redis:      ${RED}ERROR${NC}"
    fi

    # Prometheus health
    if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
        echo -e "Prometheus: ${GREEN}OK${NC}"
    else
        echo -e "Prometheus: ${RED}ERROR${NC}"
    fi

    # Grafana health
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "Grafana:    ${GREEN}OK${NC}"
    else
        echo -e "Grafana:    ${RED}ERROR${NC}"
    fi
}

# Backup data
backup() {
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    echo -e "${BLUE}Creando backup en $BACKUP_DIR...${NC}"

    # Backup Redis data
    docker compose exec -T redis redis-cli BGSAVE
    sleep 2
    docker cp editorial-redis:/data/dump.rdb "$BACKUP_DIR/redis-dump.rdb"

    # Backup Grafana data
    docker cp editorial-grafana:/var/lib/grafana "$BACKUP_DIR/grafana-data"

    # Backup environment
    cp .env "$BACKUP_DIR/.env.backup"

    echo -e "${GREEN}Backup completado: $BACKUP_DIR${NC}"
}

# Clean up
cleanup() {
    echo -e "${YELLOW}Limpiando recursos no utilizados...${NC}"
    docker system prune -f
    docker volume prune -f
    echo -e "${GREEN}Limpieza completada${NC}"
}

# Help
show_help() {
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  install     - Instalar y configurar el sistema"
    echo "  start       - Iniciar todos los servicios"
    echo "  start-prod  - Iniciar en modo producción (con Nginx)"
    echo "  stop        - Detener todos los servicios"
    echo "  restart     - Reiniciar todos los servicios"
    echo "  update      - Actualizar la aplicación"
    echo "  logs [svc]  - Ver logs (opcional: especificar servicio)"
    echo "  status      - Ver estado de los servicios"
    echo "  backup      - Crear backup de datos"
    echo "  cleanup     - Limpiar recursos Docker no utilizados"
    echo "  help        - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 install"
    echo "  $0 start"
    echo "  $0 logs app"
}

# Main
case "${1:-help}" in
    install)
        install
        ;;
    start)
        start
        ;;
    start-prod)
        start_production
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    update)
        update
        ;;
    logs)
        logs "$@"
        ;;
    status)
        status
        ;;
    backup)
        backup
        ;;
    cleanup)
        cleanup
        ;;
    help|*)
        show_help
        ;;
esac
