#!/bin/bash
#
# Script de Configuración SSL/HTTPS con Let's Encrypt
# Sistema Editorial EDITIA
#
# Uso: ./scripts/setup-ssl.sh tu-dominio.com
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Configuración SSL - Let's Encrypt    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Este script necesita permisos de root${NC}"
    echo "Ejecute: sudo $0 $@"
    exit 1
fi

# Get domain from argument or ask
DOMAIN=${1:-""}
if [ -z "$DOMAIN" ]; then
    read -p "Ingrese su dominio (ej: editorial.miempresa.com): " DOMAIN
fi

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: Dominio requerido${NC}"
    exit 1
fi

# Optional: Get email for Let's Encrypt
read -p "Ingrese su email para Let's Encrypt (opcional): " EMAIL
EMAIL_FLAG=""
if [ -n "$EMAIL" ]; then
    EMAIL_FLAG="-m $EMAIL"
else
    EMAIL_FLAG="--register-unsafely-without-email"
fi

echo ""
echo -e "${BLUE}Dominio: ${GREEN}$DOMAIN${NC}"
echo ""

# Step 1: Install Certbot
echo -e "${BLUE}[1/5] Instalando Certbot...${NC}"
if command -v apt-get &> /dev/null; then
    apt-get update
    apt-get install -y certbot
elif command -v dnf &> /dev/null; then
    dnf install -y certbot
elif command -v yum &> /dev/null; then
    yum install -y certbot
fi

# Step 2: Stop services temporarily
echo -e "${BLUE}[2/5] Deteniendo servicios...${NC}"
cd /opt/editorial-workflow
docker compose down || true

# Step 3: Obtain certificate
echo -e "${BLUE}[3/5] Obteniendo certificado SSL...${NC}"
certbot certonly --standalone \
    -d "$DOMAIN" \
    $EMAIL_FLAG \
    --agree-tos \
    --non-interactive

# Step 4: Copy certificates to nginx folder
echo -e "${BLUE}[4/5] Configurando certificados...${NC}"
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/
chmod 600 nginx/ssl/*.pem

# Step 5: Update nginx configuration
echo -e "${BLUE}[5/5] Actualizando configuración de Nginx...${NC}"

cat > nginx/nginx.conf << 'NGINX_CONF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream servers
    upstream editorial_app {
        server app:3000;
        keepalive 32;
    }

    upstream grafana {
        server grafana:3000;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Main application
        location / {
            proxy_pass http://editorial_app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # API with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://editorial_app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files caching
        location /_next/static/ {
            proxy_pass http://editorial_app;
            proxy_cache_valid 200 365d;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }

    # Grafana HTTPS
    server {
        listen 443 ssl http2;
        server_name grafana.DOMAIN_PLACEHOLDER monitoring.DOMAIN_PLACEHOLDER;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://grafana;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINX_CONF

# Replace domain placeholder
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx/nginx.conf

# Update .env with domain
if grep -q "NEXT_PUBLIC_APP_URL" .env; then
    sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://$DOMAIN|g" .env
else
    echo "NEXT_PUBLIC_APP_URL=https://$DOMAIN" >> .env
fi

# Update Grafana URL
if grep -q "GRAFANA_ROOT_URL" .env; then
    sed -i "s|GRAFANA_ROOT_URL=.*|GRAFANA_ROOT_URL=https://grafana.$DOMAIN|g" .env
else
    echo "GRAFANA_ROOT_URL=https://grafana.$DOMAIN" >> .env
fi

# Start services with production profile
echo -e "${BLUE}Iniciando servicios con SSL...${NC}"
docker compose --profile production up -d

# Setup auto-renewal cron
echo -e "${BLUE}Configurando renovación automática...${NC}"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem /opt/editorial-workflow/nginx/ssl/ && docker compose -f /opt/editorial-workflow/docker-compose.yml restart nginx") | crontab -

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  SSL Configurado Exitosamente!        ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Tu aplicación está disponible en:"
echo -e "  App:     ${GREEN}https://$DOMAIN${NC}"
echo -e "  Grafana: ${GREEN}https://grafana.$DOMAIN${NC}"
echo ""
echo -e "El certificado se renovará automáticamente cada mes."
echo ""
echo -e "${YELLOW}Nota: Asegúrese de que los DNS apunten a este servidor:${NC}"
echo -e "  $DOMAIN      -> $(curl -s ifconfig.me)"
echo -e "  grafana.$DOMAIN -> $(curl -s ifconfig.me)"
echo ""
