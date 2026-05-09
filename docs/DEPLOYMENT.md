# Guía de Despliegue - Sistema Editorial EDITIA

## Tabla de Contenidos

1. [Requisitos](#requisitos)
2. [Despliegue Local](#despliegue-local)
3. [Despliegue con Docker](#despliegue-con-docker)
4. [Despliegue en Kubernetes](#despliegue-en-kubernetes)
5. [Despliegue en Vercel](#despliegue-en-vercel)
6. [Integración con OJS](#integración-con-ojs)
7. [Configuración](#configuración)

---

## Requisitos

- Node.js 20+ o Bun 1.0+
- Docker (para contenedores)
- Kubernetes 1.25+ (para despliegue en cluster)
- OJS 3.2+ (para integración)

---

## Despliegue Local

### Con Bun (Recomendado)

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/editorial-workflow.git
cd editorial-workflow

# Instalar dependencias
bun install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Iniciar servidor de desarrollo
bun run dev

# Para producción
bun run build
bun run start
```

### Con npm

```bash
npm install
npm run dev
```

---

## Despliegue con Docker

### Construcción de imagen

```bash
# Construir imagen
docker build -t editorial-workflow:latest .

# Ejecutar contenedor
docker run -p 3000:3000 \
  -e OJS_BASE_URL=https://tu-ojs.edu/ojs \
  -e OJS_API_KEY=tu-api-key \
  editorial-workflow:latest
```

### Con Docker Compose

```bash
# Iniciar servicios
docker-compose up -d

# Con Redis para caché
docker-compose --profile with-cache up -d

# Ver logs
docker-compose logs -f app

# Detener servicios
docker-compose down
```

---

## Despliegue en Kubernetes

### Requisitos previos

1. Cluster de Kubernetes configurado
2. kubectl instalado y configurado
3. Ingress controller (nginx-ingress recomendado)
4. Cert-manager (para TLS automático)

### Despliegue básico

```bash
# Aplicar manifiestos base
kubectl apply -k k8s/base

# Ver estado de pods
kubectl get pods -l app=editorial-workflow

# Ver logs
kubectl logs -l app=editorial-workflow -f
```

### Despliegue en producción

```bash
# Crear namespace
kubectl create namespace production

# Crear secretos (editar primero k8s/base/secret.yaml)
kubectl apply -f k8s/base/secret.yaml -n production

# Aplicar overlay de producción
kubectl apply -k k8s/overlays/production

# Verificar despliegue
kubectl rollout status deployment/prod-editorial-workflow -n production
```

### Configurar Ingress

Editar `k8s/base/ingress.yaml`:

```yaml
spec:
  rules:
    - host: editorial.tu-dominio.com  # Cambiar al dominio real
```

### Escalar aplicación

```bash
# Escalar manualmente
kubectl scale deployment/editorial-workflow --replicas=5

# O usar HPA (Horizontal Pod Autoscaler)
kubectl autoscale deployment/editorial-workflow \
  --cpu-percent=70 \
  --min=2 \
  --max=10
```

---

## Despliegue en Vercel

### Método 1: Interfaz web

1. Ir a [vercel.com](https://vercel.com)
2. Importar proyecto desde GitHub
3. Configurar variables de entorno:
   - `OJS_BASE_URL`
   - `OJS_API_KEY`
   - `OJS_JOURNAL_PATH`
4. Deploy

### Método 2: Vercel CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Desplegar
vercel

# Desplegar a producción
vercel --prod
```

---

## Integración con OJS

### Requisitos de OJS

1. OJS versión 3.2 o superior
2. Plugin REST API habilitado
3. Token de API generado

### Configurar API en OJS

1. Ir a **Configuración > Sitio Web > Plugins**
2. Habilitar "REST API"
3. Ir a **Configuración > API**
4. Generar nuevo token de API
5. Copiar el token

### Variables de entorno

```env
OJS_BASE_URL=https://revista.edu/ojs
OJS_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OJS_JOURNAL_PATH=revista-principal
```

### Probar conexión

```bash
# Probar API de OJS directamente
curl -H "Authorization: Bearer TU_API_KEY" \
  https://revista.edu/ojs/api/v1/revista-principal/submissions
```

---

## Configuración

### Variables de entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `OJS_BASE_URL` | URL base de OJS | No |
| `OJS_API_KEY` | Token de API | No |
| `OJS_JOURNAL_PATH` | Path de la revista | No |
| `SUPABASE_URL` | URL de Supabase | No |
| `SUPABASE_ANON_KEY` | Key anónima de Supabase | No |
| `RESEND_API_KEY` | API key de Resend | No |
| `REDIS_URL` | URL de Redis | No |

### Secretos en Kubernetes

Editar `k8s/base/secret.yaml` antes de aplicar:

```yaml
stringData:
  OJS_BASE_URL: "https://tu-revista.edu/ojs"
  OJS_API_KEY: "tu-api-key-secreto"
```

---

## Solución de Problemas

### Error de conexión con OJS

1. Verificar que la URL es correcta
2. Verificar que el API token es válido
3. Verificar que el plugin REST API está activo
4. Revisar logs del servidor

### Pod no inicia en Kubernetes

```bash
# Ver eventos
kubectl describe pod <nombre-del-pod>

# Ver logs
kubectl logs <nombre-del-pod>

# Verificar recursos
kubectl top pods
```

### Problemas de memoria

Aumentar límites en el deployment:

```yaml
resources:
  limits:
    memory: "1Gi"
```

---

## Soporte

Para soporte técnico, contactar a:
- Email: soporte@editorial.edu
- GitHub Issues: [Crear issue](https://github.com/tu-usuario/editorial-workflow/issues)
