#!/bin/bash
#
# Script de Configuración Inicial para VPS
# Sistema Editorial EDITIA
#
# Ejecutar como root o con sudo:
# curl -fsSL https://raw.githubusercontent.com/eespina64/MyEditor/main/scripts/setup-vps.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Configuración de VPS - EDITIA        ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Este script necesita permisos de root${NC}"
    echo "Ejecute: sudo $0"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

echo -e "${BLUE}Sistema detectado: $OS $VER${NC}"
echo ""

# Update system
echo -e "${BLUE}[1/6] Actualizando sistema...${NC}"
if command -v apt-get &> /dev/null; then
    apt-get update -y
    apt-get upgrade -y
elif command -v yum &> /dev/null; then
    yum update -y
elif command -v dnf &> /dev/null; then
    dnf update -y
fi

# Install required packages
echo -e "${BLUE}[2/6] Instalando paquetes necesarios...${NC}"
if command -v apt-get &> /dev/null; then
    apt-get install -y curl git wget nano htop ufw
elif command -v yum &> /dev/null; then
    yum install -y curl git wget nano htop firewalld
elif command -v dnf &> /dev/null; then
    dnf install -y curl git wget nano htop firewalld
fi

# Install Docker
echo -e "${BLUE}[3/6] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker instalado correctamente${NC}"
else
    echo -e "${YELLOW}Docker ya está instalado${NC}"
fi

# Install Docker Compose
echo -e "${BLUE}[4/6] Verificando Docker Compose...${NC}"
if ! docker compose version &> /dev/null; then
    # Docker Compose V2 comes with Docker now, but just in case
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose instalado${NC}"
else
    echo -e "${YELLOW}Docker Compose ya está disponible${NC}"
fi

# Configure firewall
echo -e "${BLUE}[5/6] Configurando firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw --force enable
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp  # App
    ufw allow 3001/tcp  # Grafana
    ufw allow 9090/tcp  # Prometheus
    echo -e "${GREEN}Firewall configurado (ufw)${NC}"
elif command -v firewall-cmd &> /dev/null; then
    systemctl enable firewalld
    systemctl start firewalld
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=3000/tcp
    firewall-cmd --permanent --add-port=3001/tcp
    firewall-cmd --permanent --add-port=9090/tcp
    firewall-cmd --reload
    echo -e "${GREEN}Firewall configurado (firewalld)${NC}"
fi

# Clone repository
echo -e "${BLUE}[6/6] Clonando repositorio...${NC}"
INSTALL_DIR="/opt/editorial-workflow"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directorio $INSTALL_DIR ya existe. Actualizando...${NC}"
    cd "$INSTALL_DIR"
    git pull origin main
else
    git clone https://github.com/eespina64/MyEditor.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Set permissions
chmod +x scripts/*.sh

# Create .env file
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}Archivo .env creado. Por favor, configúrelo.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Instalación Completada!               ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Próximos pasos:"
echo ""
echo -e "1. Configure las variables de entorno:"
echo -e "   ${BLUE}cd $INSTALL_DIR${NC}"
echo -e "   ${BLUE}nano .env${NC}"
echo ""
echo -e "2. Inicie los servicios:"
echo -e "   ${BLUE}./scripts/deploy-vps.sh install${NC}"
echo -e "   ${BLUE}./scripts/deploy-vps.sh start${NC}"
echo ""
echo -e "3. Acceda a la aplicación:"
echo -e "   App:        ${GREEN}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "   Grafana:    ${GREEN}http://$(hostname -I | awk '{print $1}'):3001${NC}"
echo -e "   Prometheus: ${GREEN}http://$(hostname -I | awk '{print $1}'):9090${NC}"
echo ""
echo -e "Para más información, consulte:"
echo -e "   ${BLUE}$INSTALL_DIR/docs/MANUAL-COMPLETO.md${NC}"
echo ""
