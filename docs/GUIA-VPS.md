# Guía de Despliegue en VPS - Sistema Editorial EDITIA

## Tabla de Contenidos

1. [Requisitos del Servidor](#requisitos-del-servidor)
2. [Instalación Rápida](#instalación-rápida)
3. [Instalación Manual](#instalación-manual)
4. [Configuración de Variables](#configuración-de-variables)
5. [Configuración de Supabase](#configuración-de-supabase)
6. [Configuración de OJS](#configuración-de-ojs)
7. [Monitoreo con Prometheus/Grafana](#monitoreo)
8. [SSL/HTTPS con Let's Encrypt](#ssl-https)
9. [Mantenimiento](#mantenimiento)
10. [Solución de Problemas](#solución-de-problemas)

---

## Requisitos del Servidor

### Mínimos
- **CPU**: 2 vCPU
- **RAM**: 4 GB
- **Disco**: 40 GB SSD
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+

### Recomendados
- **CPU**: 4 vCPU
- **RAM**: 8 GB
- **Disco**: 80 GB SSD
- **OS**: Ubuntu 22.04 LTS

### Puertos Requeridos
| Puerto | Servicio | Descripción |
|--------|----------|-------------|
| 22 | SSH | Acceso remoto |
| 80 | HTTP | Web (redirige a HTTPS) |
| 443 | HTTPS | Web seguro |
| 3000 | App | Aplicación (desarrollo) |
| 3001 | Grafana | Dashboard de monitoreo |
| 9090 | Prometheus | Métricas |

---

## Instalación Rápida

### Opción 1: Script Automático

```bash
# Como root o con sudo
curl -fsSL https://raw.githubusercontent.com/eespina64/MyEditor/main/scripts/setup-vps.sh | bash
```

### Opción 2: Clonar y Ejecutar

```bash
# Clonar repositorio
git clone https://github.com/eespina64/MyEditor.git /opt/editorial-workflow
cd /opt/editorial-workflow

# Dar permisos a scripts
chmod +x scripts/*.sh

# Ejecutar instalación
sudo ./scripts/setup-vps.sh
```

---

## Instalación Manual

### 1. Actualizar Sistema

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo dnf update -y
```

### 2. Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Iniciar Docker
sudo systemctl enable docker
sudo systemctl start docker

# Verificar instalación
docker --version
docker compose version
```

### 3. Clonar Repositorio

```bash
# Crear directorio
sudo mkdir -p /opt/editorial-workflow
cd /opt/editorial-workflow

# Clonar
sudo git clone https://github.com/eespina64/MyEditor.git .

# Permisos
sudo chown -R $USER:$USER /opt/editorial-workflow
chmod +x scripts/*.sh
```

### 4. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar configuración
nano .env
```

### 5. Iniciar Servicios

```bash
# Construir imágenes
docker compose build

# Iniciar servicios
docker compose up -d

# Verificar estado
docker compose ps
```

---

## Configuración de Variables

### Archivo .env Completo

```env
# ===========================================
# EDITIA - Sistema Editorial
# Configuración para VPS
# ===========================================

# ----- Aplicación -----
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# ----- OJS Integration -----
OJS_BASE_URL=https://tu-ojs.edu/ojs
OJS_API_KEY=tu-api-key-de-ojs
OJS_JOURNAL_PATH=tu-revista

# ----- OJS Webhooks -----
OJS_WEBHOOK_URL=https://tu-ojs.edu/api/webhooks
OJS_WEBHOOK_SECRET=secreto-compartido-seguro

# ----- Supabase -----
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...

# ----- Redis -----
# Configurado automáticamente por Docker Compose
REDIS_URL=redis://redis:6379

# ----- Monitoreo -----
METRICS_TOKEN=tu-token-seguro-para-metricas
GRAFANA_USER=admin
GRAFANA_PASSWORD=tu-password-seguro
GRAFANA_ROOT_URL=https://grafana.tu-dominio.com
```

### Generar Secretos Seguros

```bash
# Generar token aleatorio
openssl rand -hex 32

# O usando /dev/urandom
head -c 32 /dev/urandom | base64
```

---

## Configuración de Supabase

### 1. Crear Proyecto

1. Ir a [supabase.com](https://supabase.com)
2. Crear cuenta o iniciar sesión
3. Click "New Project"
4. Configurar:
   - **Name**: editorial-workflow
   - **Database Password**: (guardar en lugar seguro)
   - **Region**: (seleccionar más cercano)
5. Esperar inicialización (~2 minutos)

### 2. Obtener Credenciales

1. Ir a **Settings > API**
2. Copiar:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Aplicar Migración

1. Ir a **SQL Editor** en Supabase
2. Click "New Query"
3. Copiar contenido de `supabase/migrations/001_initial_schema.sql`
4. Click "Run"

### 4. Verificar Tablas

```sql
-- Verificar que las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Deberían aparecer:
- profiles
- articles
- article_authors
- article_history
- article_comments
- article_reviewers

---

## Configuración de OJS

### 1. Requisitos en OJS

- OJS versión 3.2 o superior
- Plugin REST API habilitado

### 2. Habilitar API REST

1. En OJS: **Settings > Website > Plugins**
2. Buscar "REST API"
3. Habilitar el plugin

### 3. Generar API Key

1. Ir a **Profile > API Key**
2. Click "Generate API Key"
3. Copiar el token generado

### 4. Configurar Webhook (Opcional)

Para recibir notificaciones de OJS:

1. En OJS, configurar webhook URL:
   ```
   https://tu-app.com/api/webhooks/ojs
   ```
2. Seleccionar eventos a enviar

### 5. Probar Conexión

```bash
# Desde tu servidor
curl -H "Authorization: Bearer TU_API_KEY" \
  https://tu-ojs.edu/ojs/api/v1/tu-revista/submissions
```

---

## Monitoreo

### Acceso a Dashboards

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| Aplicación | http://IP:3000 | - |
| Grafana | http://IP:3001 | admin / (ver .env) |
| Prometheus | http://IP:9090 | - |

### Dashboard de Grafana Incluido

El dashboard "Editorial Workflow" muestra:

- Total de artículos
- Requests por segundo
- Latencia P95
- Errores por segundo
- Artículos por etapa
- Cache hit rate
- Latencia de API OJS

### Alertas Configuradas

| Alerta | Condición | Severidad |
|--------|-----------|-----------|
| ApplicationDown | App no responde por 1 min | Critical |
| HighErrorRate | >10% errores en 5 min | Warning |
| HighLatency | P95 > 2s por 5 min | Warning |
| RedisDown | Redis no responde por 1 min | Critical |
| OJSAPIErrors | >5% errores OJS en 5 min | Warning |

### Agregar Notificaciones

En Grafana:
1. Ir a **Alerting > Contact points**
2. Agregar canal (Email, Slack, Telegram, etc.)
3. Configurar credenciales
4. Asociar alertas al canal

---

## SSL/HTTPS con Let's Encrypt

### 1. Instalar Certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx -y

# CentOS
sudo dnf install certbot python3-certbot-nginx -y
```

### 2. Obtener Certificado

```bash
# Detener servicios temporalmente
docker compose down

# Obtener certificado
sudo certbot certonly --standalone -d tu-dominio.com -d www.tu-dominio.com

# Los certificados se guardan en:
# /etc/letsencrypt/live/tu-dominio.com/
```

### 3. Configurar Nginx con SSL

```bash
# Copiar certificados al proyecto
sudo cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem nginx/ssl/

# Editar nginx.conf y descomentar líneas SSL
nano nginx/nginx.conf
```

### 4. Renovación Automática

```bash
# Agregar cron job
sudo crontab -e

# Agregar línea:
0 0 1 * * certbot renew --quiet && docker compose restart nginx
```

---

## Mantenimiento

### Comandos Útiles

```bash
# Ver estado de servicios
./scripts/deploy-vps.sh status

# Ver logs
./scripts/deploy-vps.sh logs
./scripts/deploy-vps.sh logs app

# Reiniciar servicios
./scripts/deploy-vps.sh restart

# Actualizar aplicación
./scripts/deploy-vps.sh update

# Crear backup
./scripts/deploy-vps.sh backup

# Limpiar recursos Docker
./scripts/deploy-vps.sh cleanup
```

### Actualización del Sistema

```bash
# Actualizar desde GitHub
cd /opt/editorial-workflow
git pull origin main

# Reconstruir y reiniciar
docker compose build app
docker compose up -d app
```

### Backups

```bash
# Backup manual
./scripts/deploy-vps.sh backup

# Los backups se guardan en: backups/YYYYMMDD_HHMMSS/
# Incluye:
# - redis-dump.rdb (datos de cache)
# - grafana-data/ (dashboards y configuración)
# - .env.backup (configuración)
```

### Restaurar Backup

```bash
# Detener servicios
docker compose down

# Restaurar Redis
docker cp backups/XXXXXXXX_XXXXXX/redis-dump.rdb editorial-redis:/data/dump.rdb

# Restaurar Grafana
docker cp backups/XXXXXXXX_XXXXXX/grafana-data editorial-grafana:/var/lib/grafana

# Reiniciar
docker compose up -d
```

---

## Solución de Problemas

### La aplicación no inicia

```bash
# Ver logs detallados
docker compose logs app --tail=100

# Verificar configuración
docker compose config

# Reconstruir imagen
docker compose build --no-cache app
```

### Error de conexión a Redis

```bash
# Verificar que Redis está corriendo
docker compose ps redis

# Probar conexión
docker compose exec redis redis-cli ping
```

### Error de conexión a OJS

```bash
# Probar API desde el servidor
curl -v -H "Authorization: Bearer $OJS_API_KEY" \
  "$OJS_BASE_URL/api/v1/$OJS_JOURNAL_PATH/submissions"

# Verificar variables de entorno
docker compose exec app env | grep OJS
```

### Prometheus no recolecta métricas

```bash
# Verificar endpoint de métricas
curl http://localhost:3000/api/metrics

# Ver configuración de Prometheus
cat monitoring/prometheus.yml

# Reiniciar Prometheus
docker compose restart prometheus
```

### Grafana no muestra datos

1. Verificar que Prometheus está corriendo
2. En Grafana: **Configuration > Data Sources > Prometheus > Test**
3. Verificar URL: `http://prometheus:9090`

### Espacio en disco lleno

```bash
# Ver uso de disco
df -h

# Limpiar logs Docker
docker system prune -f

# Limpiar imágenes no usadas
docker image prune -a -f

# Limpiar volúmenes no usados
docker volume prune -f
```

### Memoria insuficiente

```bash
# Ver uso de memoria
free -h

# Ver uso por contenedor
docker stats

# Reiniciar contenedores con problemas
docker compose restart
```

---

## Contacto y Soporte

- **Repositorio**: https://github.com/eespina64/MyEditor
- **Issues**: https://github.com/eespina64/MyEditor/issues
- **Documentación**: `/docs/MANUAL-COMPLETO.md`
