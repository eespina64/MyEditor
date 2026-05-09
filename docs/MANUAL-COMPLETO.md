# Manual Completo - Sistema Editorial EDITIA

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Requisitos del Sistema](#requisitos-del-sistema)
3. [Instalación](#instalación)
4. [Configuración de OJS](#configuración-de-ojs)
5. [Autenticación con Supabase](#autenticación-con-supabase)
6. [Sistema de Webhooks](#sistema-de-webhooks)
7. [Cache con Redis](#cache-con-redis)
8. [Monitoreo con Prometheus/Grafana](#monitoreo-con-prometheusgrafana)
9. [Despliegue en Kubernetes](#despliegue-en-kubernetes)
10. [API Reference](#api-reference)
11. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

EDITIA es un sistema de gestión de flujo editorial diseñado para revistas académicas. Integra con Open Journal Systems (OJS) y proporciona:

- Tablero Kanban con 6 etapas del proceso editorial
- Dashboard con estadísticas en tiempo real
- Integración bidireccional con OJS
- Autenticación basada en roles
- Cache distribuido para alto rendimiento
- Monitoreo completo con métricas

---

## Requisitos del Sistema

### Desarrollo Local
- Node.js 20+ o Bun 1.0+
- Git

### Producción
- Docker 24+
- Kubernetes 1.25+ (opcional)
- Redis 7+ (opcional, para cache)
- PostgreSQL 15+ o Supabase

### Integraciones
- OJS 3.2+ (para integración)
- Supabase (para autenticación y base de datos)

---

## Instalación

### Desarrollo Local

```bash
# Clonar repositorio
git clone https://github.com/eespina64/MyEditor.git
cd MyEditor

# Instalar dependencias
bun install

# Copiar variables de entorno
cp .env.example .env.local

# Editar .env.local con sus valores
nano .env.local

# Iniciar servidor de desarrollo
bun run dev
```

### Con Docker

```bash
# Construir imagen
docker build -t editorial-workflow:latest .

# Ejecutar con variables de entorno
docker run -p 3000:3000 \
  -e OJS_BASE_URL=https://tu-ojs.edu/ojs \
  -e OJS_API_KEY=tu-api-key \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key \
  editorial-workflow:latest
```

### Con Docker Compose

```bash
# Iniciar todos los servicios
docker-compose up -d

# Con Redis cache
docker-compose --profile with-cache up -d

# Ver logs
docker-compose logs -f app
```

---

## Configuración de OJS

### 1. Requisitos en OJS

1. OJS versión 3.2 o superior
2. Plugin REST API habilitado
3. Token de API generado

### 2. Habilitar API en OJS

1. Ir a **Configuración > Sitio Web > Plugins**
2. Buscar y habilitar "REST API"
3. Ir a **Configuración > Usuarios y Roles > API Keys**
4. Crear nuevo token de API

### 3. Variables de Entorno

```env
OJS_BASE_URL=https://revista.edu/ojs
OJS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OJS_JOURNAL_PATH=mi-revista
```

### 4. Probar Conexión

```bash
# Verificar API directamente
curl -H "Authorization: Bearer TU_API_KEY" \
  https://revista.edu/ojs/api/v1/mi-revista/submissions

# Desde la aplicación
curl http://localhost:3000/api/ojs/status
```

### 5. Sincronización

La sincronización se puede realizar:

- **Manual**: Desde el panel OJS en la interfaz
- **Automática**: Configurando webhooks (ver siguiente sección)
- **Programada**: Usando cron jobs

---

## Autenticación con Supabase

### 1. Crear Proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Copiar URL y Anon Key

### 2. Configurar Base de Datos

```bash
# Aplicar migración inicial
psql -h db.xxx.supabase.co -U postgres -d postgres \
  -f supabase/migrations/001_initial_schema.sql
```

O desde el SQL Editor en Supabase Dashboard.

### 3. Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso completo, gestión de usuarios |
| `editor` | Gestión de artículos, asignación de revisores |
| `reviewer` | Revisión de artículos asignados |
| `author` | Envío y seguimiento de sus artículos |

### 5. Modo Demo

Si Supabase no está configurado, el sistema funciona en modo demo con usuarios predefinidos:

- Dr. María García (admin)
- Prof. Juan López (editor)
- Ana Martínez (reviewer)
- Carlos Rodríguez (author)

---

## Sistema de Webhooks

### Webhooks Entrantes (OJS → Sistema)

#### Configurar en OJS

1. Ir a configuración de plugins en OJS
2. Configurar URL de webhook: `https://tu-app.com/api/webhooks/ojs`
3. Seleccionar eventos a enviar

#### Eventos Soportados

| Evento | Descripción |
|--------|-------------|
| `submission.created` | Nuevo envío creado |
| `submission.updated` | Envío actualizado |
| `submission.statusChanged` | Cambio de estado |
| `submission.published` | Artículo publicado |
| `submission.declined` | Artículo rechazado |
| `review.assigned` | Revisor asignado |
| `review.completed` | Revisión completada |
| `revision.requested` | Revisión solicitada |
| `revision.submitted` | Revisión enviada |

#### Verificar Webhooks

```bash
# Ver estado y eventos recientes
curl http://localhost:3000/api/webhooks/ojs?events=true
```

### Webhooks Salientes (Sistema → OJS)

#### Configurar Variables

```env
OJS_WEBHOOK_URL=https://tu-ojs.edu/ojs/api/webhooks
OJS_WEBHOOK_SECRET=tu-secreto-compartido
```

#### Eventos Emitidos

```typescript
// Ejemplos de uso
import { webhookEvents } from '@/lib/webhooks';

// Artículo creado
webhookEvents.articleCreated(articleId, title, authors);

// Cambio de etapa
webhookEvents.articleStageChanged(articleId, 'recepcion', 'evaluacion_inicial', userId);

// Decisión tomada
webhookEvents.decisionMade(articleId, 'accept', editorId);
```

---

## Cache con Redis

### 1. Configuración

```env
REDIS_URL=redis://localhost:6379
# O con autenticación
REDIS_URL=redis://:password@host:6379
```

### 2. Uso del Cache

```typescript
import { getCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis';

const cache = getCache();

// Obtener con fallback
const stats = await cache.getOrSet(
  CACHE_KEYS.OJS_STATS,
  async () => await ojsClient.getStats(),
  CACHE_TTL.OJS_STATS
);

// Invalidar cache
await cache.del(CACHE_KEYS.OJS_STATS);

// Invalidar por patrón
await cache.invalidatePattern('ojs:*');
```

### 3. TTLs Predefinidos

| Key | TTL | Descripción |
|-----|-----|-------------|
| `ojs:stats` | 5 min | Estadísticas de OJS |
| `ojs:submissions` | 2 min | Lista de envíos |
| `ojs:submission:*` | 3 min | Envío individual |
| `articles:*` | 1 min | Artículos locales |
| `session:*` | 1 hora | Sesiones de usuario |

### 4. Docker Compose con Redis

```yaml
services:
  app:
    # ...
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

---

## Monitoreo con Prometheus/Grafana

### 1. Métricas Disponibles

#### HTTP
- `editorial_http_requests_total` - Total de requests
- `editorial_http_request_duration_seconds` - Latencia
- `editorial_http_request_errors_total` - Errores

#### Artículos
- `editorial_articles_total` - Total de artículos
- `editorial_articles_by_stage` - Por etapa
- `editorial_articles_by_priority` - Por prioridad
- `editorial_article_stage_changes_total` - Cambios de etapa

#### OJS
- `editorial_ojs_api_calls_total` - Llamadas a API
- `editorial_ojs_api_errors_total` - Errores de API
- `editorial_ojs_api_latency_seconds` - Latencia
- `editorial_ojs_sync_operations_total` - Sincronizaciones

#### Cache
- `editorial_cache_hits_total` - Hits de cache
- `editorial_cache_misses_total` - Misses de cache

### 2. Endpoint de Métricas

```bash
# Formato Prometheus
curl http://localhost:3000/api/metrics

# Formato JSON
curl http://localhost:3000/api/metrics?format=json
```

### 3. Desplegar Prometheus/Grafana en Kubernetes

```bash
# Crear namespace
kubectl create namespace monitoring

# Aplicar configuración
kubectl apply -k k8s/monitoring/

# Verificar pods
kubectl get pods -n monitoring

# Port-forward Grafana
kubectl port-forward svc/grafana 3001:3000 -n monitoring
```

### 4. Acceder a Grafana

- URL: http://localhost:3001
- Usuario: admin
- Password: editorial-admin-2024 (cambiar en producción)

### 5. Dashboard Incluido

El dashboard "Editorial Workflow" incluye:

- Total de artículos
- Requests por segundo
- Latencia P95
- Errores por segundo
- Artículos por etapa
- Latencia de API OJS

---

## Despliegue en Kubernetes

### 1. Requisitos

- kubectl configurado
- Cluster Kubernetes 1.25+
- Ingress Controller (nginx recomendado)
- Cert-Manager (para TLS)

### 2. Configurar Secretos

```bash
# Editar secretos
kubectl create secret generic editorial-workflow-secrets \
  --from-literal=OJS_BASE_URL=https://tu-ojs.edu \
  --from-literal=OJS_API_KEY=tu-api-key \
  --from-literal=SUPABASE_URL=https://xxx.supabase.co \
  --from-literal=SUPABASE_ANON_KEY=tu-anon-key \
  -n production
```

### 3. Desplegar Aplicación

```bash
# Crear namespace
kubectl create namespace production

# Aplicar manifiestos
kubectl apply -k k8s/overlays/production

# Verificar despliegue
kubectl rollout status deployment/prod-editorial-workflow -n production

# Ver pods
kubectl get pods -n production
```

### 4. Configurar Ingress

Editar `k8s/base/ingress.yaml`:

```yaml
spec:
  rules:
    - host: editorial.tu-dominio.com
```

### 5. Escalar

```bash
# Manual
kubectl scale deployment/editorial-workflow --replicas=5 -n production

# Autoscaling
kubectl autoscale deployment/editorial-workflow \
  --cpu-percent=70 --min=2 --max=10 -n production
```

---

## API Reference

### Artículos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/metrics` | GET | Métricas Prometheus |

### OJS

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/ojs/status` | GET | Estado de conexión |
| `/api/ojs/stats` | GET | Estadísticas |
| `/api/ojs/submissions` | GET | Lista de envíos |
| `/api/ojs/sync` | POST | Sincronizar artículos |

### Webhooks

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/webhooks/ojs` | POST | Recibir eventos de OJS |
| `/api/webhooks/ojs` | GET | Estado de webhooks |

---

## Solución de Problemas

### OJS no conecta

1. Verificar URL y API Key
2. Comprobar que REST API está habilitado
3. Revisar logs: `docker-compose logs app`

### Cache no funciona

1. Verificar conexión Redis: `redis-cli ping`
2. Revisar REDIS_URL en variables de entorno
3. El sistema usa memoria como fallback

### Métricas no aparecen

1. Verificar endpoint: `curl /api/metrics`
2. Comprobar configuración de Prometheus
3. Revisar scrape_configs en prometheus.yml

### Pods no inician

```bash
# Ver eventos
kubectl describe pod <nombre> -n production

# Ver logs
kubectl logs <nombre> -n production

# Verificar recursos
kubectl top pods -n production
```

### Errores de autenticación

1. Verificar credenciales de Supabase
2. Comprobar políticas RLS en base de datos
3. Revisar token JWT expirado

---

## Soporte

- **Repositorio**: https://github.com/eespina64/MyEditor
- **Issues**: https://github.com/eespina64/MyEditor/issues
- **Email**: soporte@editorial.edu
