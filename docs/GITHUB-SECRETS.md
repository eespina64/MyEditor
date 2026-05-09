# Configuración de GitHub Secrets

Esta guía explica cómo configurar los secrets de GitHub para habilitar el despliegue automático y las notificaciones.

## Acceder a la Configuración de Secrets

1. Ve a tu repositorio en GitHub: https://github.com/eespina64/MyEditor
2. Click en **Settings** (pestaña superior)
3. En el menú lateral, click en **Secrets and variables** → **Actions**
4. Click en **New repository secret**

---

## Secrets Requeridos para Despliegue VPS

### VPS_HOST
- **Descripción**: Dirección IP o hostname de tu servidor VPS
- **Ejemplo**: `192.168.1.100` o `mi-servidor.com`

### VPS_USER
- **Descripción**: Usuario SSH para conectar al servidor
- **Ejemplo**: `root` o `deploy`

### VPS_SSH_KEY
- **Descripción**: Clave privada SSH para autenticación
- **Cómo obtener**:

```bash
# En tu máquina local, genera una clave SSH
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy

# Copia la clave pública al servidor
ssh-copy-id -i ~/.ssh/github_deploy.pub root@TU_VPS_IP

# Muestra la clave privada (esto es lo que copias a GitHub)
cat ~/.ssh/github_deploy
```

Copia todo el contenido, incluyendo:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### VPS_PORT (Opcional)
- **Descripción**: Puerto SSH si es diferente de 22
- **Ejemplo**: `2222`

---

## Secrets para Notificaciones

### SLACK_WEBHOOK_URL

1. Ve a https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Nombre: "Editorial Workflow"
4. Selecciona tu workspace
5. En **Features** → **Incoming Webhooks** → Enable
6. Click **Add New Webhook to Workspace**
7. Selecciona el canal
8. Copia la URL del webhook

**Formato**: `https://hooks.slack.com/services/TXXXXX/BXXXXX/your-token-here`

### DISCORD_WEBHOOK_URL

1. En Discord, ve al canal donde quieres notificaciones
2. Click en el ícono de configuración del canal
3. **Integrations** → **Webhooks** → **New Webhook**
4. Configura nombre y avatar
5. Click **Copy Webhook URL**

**Formato**: `https://discord.com/api/webhooks/000000000000000000/XXXXXXXXXXXXXXXXXXXX`

---

## Secrets para Kubernetes (Opcional)

### KUBE_CONFIG_PRODUCTION

Si usas Kubernetes en lugar de Docker en VPS:

```bash
# En tu máquina con acceso al cluster
cat ~/.kube/config | base64 -w 0
```

Copia la salida completa.

---

## Resumen de Secrets

| Secret | Requerido | Descripción |
|--------|-----------|-------------|
| `VPS_HOST` | Sí | IP del servidor |
| `VPS_USER` | Sí | Usuario SSH |
| `VPS_SSH_KEY` | Sí | Clave privada SSH |
| `VPS_PORT` | No | Puerto SSH (default: 22) |
| `SLACK_WEBHOOK_URL` | No | Webhook de Slack |
| `DISCORD_WEBHOOK_URL` | No | Webhook de Discord |
| `KUBE_CONFIG_PRODUCTION` | No | Config de Kubernetes |

---

## Verificar Configuración

Después de configurar los secrets, puedes probar el pipeline:

1. Haz un pequeño cambio en el código
2. Commit y push a `main`
3. Ve a **Actions** en GitHub para ver el progreso

O ejecuta manualmente:

1. Ve a **Actions** → **CI/CD Pipeline**
2. Click **Run workflow**
3. Selecciona la acción (deploy, backup, restart)
4. Click **Run workflow**

---

## Acciones Disponibles

### Despliegue Automático
Se ejecuta automáticamente en cada push a `main`.

### Backup Manual
1. **Actions** → **CI/CD Pipeline** → **Run workflow**
2. Selecciona `backup`
3. **Run workflow**

### Reiniciar Servicios
1. **Actions** → **CI/CD Pipeline** → **Run workflow**
2. Selecciona `restart`
3. **Run workflow**

### Backup Automático Diario
Se ejecuta automáticamente todos los días a las 2:00 AM UTC.

---

## Solución de Problemas

### Error: "Permission denied (publickey)"
- Verifica que la clave pública esté en `~/.ssh/authorized_keys` del servidor
- Verifica que la clave privada en el secret sea correcta y completa

### Error: "Host key verification failed"
- Conecta manualmente primero para aceptar el host:
```bash
ssh -i ~/.ssh/github_deploy root@TU_VPS_IP
```

### Las notificaciones no llegan
- Verifica que la URL del webhook sea correcta
- Prueba el webhook manualmente:
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test"}' \
  TU_WEBHOOK_URL
```

---

## Seguridad

- Los secrets están encriptados en GitHub
- Solo son accesibles durante la ejecución del workflow
- No se muestran en los logs (aparecen como `***`)
- Rota las claves SSH periódicamente
- Usa usuarios con permisos mínimos necesarios
