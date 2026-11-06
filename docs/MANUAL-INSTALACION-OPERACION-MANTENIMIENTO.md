# Manual de instalación, operación y mantenimiento — EDITIA

Versión del manual: 2026-11-06. Corresponde a la rama `main` del repositorio `eespina64/MyEditor` a partir de esa fecha.

Este manual sustituye a las secciones de instalación y actualización de `docs/GUIA-VPS.md`, `docs/DEPLOYMENT.md` y `docs/MANUAL-COMPLETO.md`.
Esas guías contienen afirmaciones que ya no coinciden con el código; la sección 7 las enumera.

## Contenido

1. [Arquitectura](#1-arquitectura)
2. [Instalación](#2-instalación)
3. [Operación](#3-operación)
4. [Mantenimiento](#4-mantenimiento)
5. [Actualización con varios agentes (DeepSeek Harness y Claude Code)](#5-actualización-con-varios-agentes-deepseek-harness-y-claude-code)
6. [Solución de problemas](#6-solución-de-problemas)
7. [Problemas conocidos y limitaciones](#7-problemas-conocidos-y-limitaciones)
8. [Referencia](#8-referencia)
9. [Fuentes](#9-fuentes)

---

## 1. Arquitectura

EDITIA es una aplicación Next.js 15 que se ejecuta en un VPS con Docker Compose.
Supabase y OJS son servicios externos; la aplicación funciona en modo demostración sin ellos.

| Componente | Dónde se ejecuta | Puerto | Notas |
|---|---|---|---|
| `app` (contenedor `editorial-app`) | VPS, imagen `editia-app:latest` | 3000 | Construida en el servidor desde `Dockerfile` |
| `redis` (`editorial-redis`) | VPS | 6379 | La app no lo usa todavía (sección 7) |
| `prometheus` (`editorial-prometheus`) | VPS | 9090 | Configuración en `monitoring/prometheus.yml` |
| `grafana` (`editorial-grafana`) | VPS | 3001 | Paneles en `monitoring/grafana/` |
| `nginx` (`editorial-nginx`) | VPS, solo con el perfil `production` | 80, 443 | Configuración en `nginx/nginx.conf` |
| Supabase | Externo | — | Autenticación y esquema en `supabase/migrations/` |
| OJS | Externo | — | API REST de la revista |
| Netlify (proyecto `editia`) | Externo | — | Construye una vista previa en cada pull request |

El despliegue automático funciona así.
Cada push a `main` ejecuta `.github/workflows/ci-cd.yaml`: `test`, `build` (imagen en `ghcr.io/eespina64/myeditor`) y `deploy`.
`deploy` entra por SSH en el VPS y ejecuta `scripts/upgrade.sh`, que reconstruye la imagen en el servidor.
La imagen de `ghcr.io` no se usa en el VPS.

---

## 2. Instalación

### 2.1 Requisitos del servidor

| | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 40 GB SSD | 80 GB SSD |
| Sistema | Ubuntu 20.04+, Debian 11+ | Ubuntu 22.04 LTS |

Fuente: `docs/GUIA-VPS.md`, sección de requisitos.
Cada actualización construye una imagen nueva y conserva la anterior para poder volver atrás, así que deje al menos 2 GB libres; `upgrade.sh --check` avisa si hay menos.

### 2.2 Preparar el servidor

Como `root` en el VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/eespina64/MyEditor/main/scripts/setup-vps.sh -o setup-vps.sh
less setup-vps.sh          # revíselo antes de ejecutarlo
bash setup-vps.sh
```

El script actualiza el sistema, instala Docker y Docker Compose, abre el cortafuegos (ufw o firewalld) y clona el repositorio en `/opt/editorial-workflow`.
Al final crea `.env` a partir de `config/env.template` con permisos `600`.

Instale también `curl` (lo usa la comprobación de salud) y, si va a copiar la base de datos, el cliente de PostgreSQL:

```bash
apt-get install -y curl postgresql-client
```

### 2.3 Configurar `.env`

Edite `/opt/editorial-workflow/.env`.
Todas las variables están documentadas en `config/env.template`; la tabla completa está en la sección 8.1.

Mínimos para producción:

- `METRICS_TOKEN`: un valor propio y largo. Si lo deja vacío, `docker-compose.yml` usa un valor por defecto que está publicado en el repositorio.
- `GRAFANA_PASSWORD`: una contraseña propia. Sin ella Grafana usa `editorial-admin-2024`.
- `OJS_BASE_URL`, `OJS_API_KEY`, `OJS_JOURNAL_PATH`: si va a conectar OJS.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: si va a usar Supabase.

Las variables `NEXT_PUBLIC_*` se incrustan en el código del navegador al construir la imagen.
Si las cambia, hay que reconstruir: `scripts/upgrade.sh --force`.

### 2.4 Base de datos (Supabase, opcional)

1. Cree un proyecto en Supabase y copie la URL y la clave anónima en `.env`.
2. Aplique `supabase/migrations/001_initial_schema.sql` una sola vez, desde el editor SQL de Supabase o con:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/001_initial_schema.sql
```

El archivo no es idempotente: ejecutarlo dos veces falla al crear tablas y políticas que ya existen.
No use `scripts/setup-supabase.sh --apply` sobre una base ya inicializada: ejecuta `psql` sin `ON_ERROR_STOP` y da por buena la ejecución aunque haya errores.

### 2.5 Primer arranque

```bash
cd /opt/editorial-workflow
GIT_SHA=$(git rev-parse HEAD) docker compose up -d --build
scripts/upgrade.sh --status
```

`GIT_SHA` hace que `/api/health` devuelva el commit desplegado.
Con nginx y HTTPS, el arranque es `docker compose --profile production up -d` después de configurar SSL (sección 2.6).

Compruebe:

```bash
curl -s http://localhost:3000/api/health
# {"status":"healthy","timestamp":"…","version":"<commit>"}
```

### 2.6 Dominio y HTTPS

```bash
scripts/setup-ssl.sh editorial.su-dominio.edu
```

El script obtiene un certificado de Let's Encrypt, reescribe `nginx/nginx.conf` para ese dominio y programa la renovación.
`upgrade.sh` conserva esa versión local de `nginx.conf` en cada actualización.
La renovación automática tiene un fallo conocido (sección 7, punto 6): compruébela antes de 60 días.

### 2.7 Despliegue automático desde GitHub

En GitHub, **Settings → Secrets and variables → Actions**, cree:

| Secreto | Valor |
|---|---|
| `VPS_HOST` | IP o nombre del VPS |
| `VPS_SSH_KEY` | Clave privada SSH con acceso al VPS |
| `VPS_USER` | Usuario SSH (por defecto `root`) |
| `VPS_PORT` | Puerto SSH (por defecto `22`) |
| `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | Opcionales, para avisos |

Sin `VPS_HOST` y `VPS_SSH_KEY`, el trabajo `deploy` termina en verde pero no despliega; su registro muestra «VPS deployment skipped - secrets not configured».
Para desplegar a mano desde GitHub: **Actions → CI/CD Pipeline → Run workflow**, con `action: deploy`.

### 2.8 Netlify

El repositorio está conectado al proyecto de Netlify `editia`, que construye una vista previa por pull request (`deploy-preview-<n>--editia.netlify.app`).
La configuración está en `netlify.toml`.
Netlify y el VPS se despliegan por separado y en paralelo; el VPS es la instalación con Docker, Redis y monitorización.

### 2.9 Entorno de desarrollo

```bash
git clone https://github.com/eespina64/MyEditor.git && cd MyEditor
bun install
bun run dev        # http://localhost:3000
bun run build      # un cambio está terminado cuando esto pasa sin errores
```

---

## 3. Operación

### 3.1 Comandos diarios

Desde `/opt/editorial-workflow`:

| Tarea | Comando |
|---|---|
| Versión, salud y vuelta atrás disponible | `scripts/upgrade.sh --status` |
| Estado de los contenedores | `docker compose ps` |
| Logs de la app | `docker compose logs -f --tail 100 app` |
| Reiniciar la app | `docker compose restart app` |
| Parar todo | `docker compose down` |
| Arrancar todo | `docker compose up -d` (o `--profile production up -d` con nginx) |

`docker compose down` no borra los volúmenes de Redis, Prometheus y Grafana.
No use `down -v`, que sí los borra.

### 3.2 Qué hace la aplicación

La aplicación tiene una página principal con tres pestañas: **Tablero** (kanban de seis etapas), **Dashboard** (indicadores y gráficas) y **OJS** (estado, estadísticas y envíos de la revista).
`/settings/ojs` es una pantalla de configuración de demostración: «Guardar» no persiste nada.

Los artículos del tablero se guardan en el `localStorage` del navegador (clave `editorial-workflow-storage`).
Cada navegador tiene sus propios datos: no se comparten entre usuarios ni se guardan en el servidor, y borrar los datos del navegador los elimina.
El inicio de sesión es un selector de usuarios de demostración.

### 3.3 Puntos de acceso de la API

| Método y ruta | Uso | Autenticación |
|---|---|---|
| `GET /api/health` | Salud y commit desplegado | Ninguna |
| `GET /api/metrics` (`?format=json`) | Métricas Prometheus | `Authorization: Bearer <METRICS_TOKEN>` si está definido |
| `GET /api/ojs/status` | Prueba la conexión con OJS | Ninguna |
| `GET /api/ojs/stats` | Envíos por estado | Ninguna |
| `GET /api/ojs/submissions` | Lista envíos (`count`, `offset`, `status`) | Ninguna |
| `POST /api/ojs/sync` | Trae hasta 100 envíos (no los guarda) | Ninguna |
| `POST /api/webhooks/ojs` | Recibe eventos de OJS | Cabecera `x-ojs-signature` si hay `OJS_WEBHOOK_SECRET` |
| `GET /api/webhooks/ojs?events=true` | Últimos 20 eventos recibidos (en memoria) | Ninguna |

No hay autenticación en las rutas de OJS.
Si el servidor es público, limite el acceso a `/api/ojs/*` en nginx o con el cortafuegos.

### 3.4 Monitorización

- **Salud**: `GET /api/health` responde siempre `healthy` mientras el proceso vive; no comprueba OJS ni Supabase.
- **Métricas**: `curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:3000/api/metrics`.
- **Prometheus**: `http://<servidor>:9090`. Reglas de alerta en `monitoring/alerts.yml`.
- **Grafana**: `http://<servidor>:3001`, usuario `GRAFANA_USER`. Panel «editorial-workflow-main».

Prometheus no envía el token al leer `/api/metrics`, así que con `METRICS_TOKEN` definido el objetivo aparece caído y la alerta `ApplicationDown` salta.
Los objetivos `redis` y `cadvisor` tampoco funcionan (sección 7, punto 4).

### 3.5 Webhook de OJS

OJS debe enviar `POST https://<dominio>/api/webhooks/ojs` con JSON `{"event": "...", "timestamp": "...", "data": {"submissionId": ...}}` y la cabecera `x-ojs-signature`.
OJS no trae webhooks salientes de serie, así que hace falta un plugin en OJS que los envíe (inferido; no hay ningún plugin en este repositorio).
Hoy el webhook solo registra el evento: no actualiza el tablero (sección 7, punto 3).

---

## 4. Mantenimiento

### 4.1 Actualizar

`scripts/upgrade.sh` es el único procedimiento de actualización.
Sustituye a `git pull` + `docker compose up -d --build` y a `scripts/deploy-vps.sh update`.

Qué hace, en orden:

1. Impide dos actualizaciones a la vez (`flock`).
2. Descarga la rama (`git fetch`) y compara la versión instalada con la nueva.
3. Se detiene si hay cambios locales en archivos versionados, salvo `nginx/nginx.conf`, que conserva.
4. Avisa si la nueva versión trae migraciones en `supabase/migrations/`.
5. Crea una copia en `backups/upgrade-<fecha>-<commit>.tar.gz`.
6. Guarda la imagen en servicio como `editia-app:rollback`.
7. Actualiza el código y construye la imagen nueva sin parar el servicio.
8. Sustituye el contenedor y espera a que esté sano y sirva el commit nuevo (hasta `HEALTH_TIMEOUT`, 180 s por defecto).
9. Si la construcción falla, restaura el código y deja el servicio como estaba.
10. Si el contenedor nuevo no queda sano, vuelve automáticamente al código y la imagen anteriores.

Uso:

```bash
cd /opt/editorial-workflow
scripts/upgrade.sh --check       # qué cambiaría, sin tocar nada
scripts/upgrade.sh               # actualizar a la última versión de main
scripts/upgrade.sh --status      # versión en servicio y vuelta atrás disponible
scripts/upgrade.sh --rollback    # volver a la versión anterior
```

Opciones: `--branch <rama>`, `--dir <ruta>`, `--skip-backup`, `--force` (reconstruir sin cambios).
Variables: `HEALTH_URL`, `HEALTH_TIMEOUT`, `KEEP_BACKUPS` (10 por defecto) y `SUPABASE_DB_URL`.

| Código de salida | Significado | Qué hacer |
|---|---|---|
| 0 | Actualizado, o ya estaba al día | Nada |
| 1 | Falló; el servicio sigue en la versión anterior | Revise el mensaje y `docker compose logs app` |
| 2 | Uso incorrecto o instalación no encontrada | Revise las opciones y `--dir` |
| 3 | Otra actualización en curso | Espere y repita |
| 4 | La versión anterior tampoco quedó sana | Incidencia: sección 6 |

Cada resultado queda en `.upgrade/history.log`.
El despliegue de GitHub Actions ejecuta la versión de `upgrade.sh` de la rama desplegada, no la copia que haya en el servidor.

Comportamiento comprobado el 2026-11-06 en una instalación simulada con Docker:

| Prueba | Resultado |
|---|---|
| Actualización correcta con `nginx.conf` modificado en el servidor y una migración nueva | Salida 0; commit nuevo servido; `nginx.conf` local conservado; aviso de migración; copia creada |
| `--rollback` después de una actualización correcta | Código e imagen anteriores en servicio y sanos |
| Versión nueva que no responde en `/api/health` | Contenedor `unhealthy`; vuelta atrás automática; salida 1; servicio sano |
| Versión nueva cuya imagen no se construye | Salida 1; contenedor en servicio sin reiniciar; código restaurado |
| Cambio local en un archivo versionado | Actualización rechazada antes de tocar nada |
| Segunda actualización simultánea | Rechazada con salida 3 |

### 4.2 Copias de seguridad

Cada actualización guarda en `backups/upgrade-<fecha>-<commit>.tar.gz`: `.env` (como `env`), `nginx/` con los certificados, el commit anterior (`git-sha`) y los cambios locales (`local-changes.diff`).
Se conservan las 10 más recientes.

**Los datos de Supabase no se copian salvo que lo pida.**
Exporte la cadena de conexión solo en la sesión de mantenimiento y `upgrade.sh` añadirá `supabase.dump`:

```bash
export SUPABASE_DB_URL='postgresql://…'     # Supabase → Project Settings → Database
scripts/upgrade.sh
```

Si `pg_dump` falla, la actualización se detiene antes de tocar nada.
Si `pg_dump` informa de una versión de servidor más nueva, instale el cliente de PostgreSQL de esa versión.

Copie las copias fuera del servidor con regularidad, por ejemplo:

```bash
rsync -a /opt/editorial-workflow/backups/ backup@otro-servidor:/copias/editia/
```

`scripts/backup.sh` y la copia diaria de GitHub Actions guardan el volcado de Redis y `.env`; tienen fallos de restauración conocidos (sección 7, punto 7).

### 4.3 Restaurar

Restaurar configuración y certificados desde una copia de actualización:

```bash
cd /opt/editorial-workflow
tar -xzf backups/upgrade-<fecha>-<commit>.tar.gz -C /tmp
cp /tmp/upgrade-<fecha>-<commit>/env .env && chmod 600 .env
cp -a /tmp/upgrade-<fecha>-<commit>/nginx/. nginx/
docker compose up -d
```

Volver al código de esa copia: `scripts/upgrade.sh --rollback` si es la versión anterior inmediata.
Si es más antigua: `git reset --hard <commit>` y `GIT_SHA=<commit> docker compose up -d --build app`.

Restaurar la base de datos de Supabase (sobrescribe los objetos existentes):

```bash
pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL" /tmp/upgrade-<fecha>-<commit>/supabase.dump
```

Pruebe la restauración en un proyecto de Supabase de prueba antes de necesitarla.

### 4.4 Migraciones de base de datos

`upgrade.sh` no aplica migraciones: solo avisa cuando la versión nueva trae archivos en `supabase/migrations/`.
Aplíquelas a mano, cada una una vez y en orden:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<archivo>.sql
```

Decida el orden según el cambio: una migración que solo añade tablas o columnas puede ir antes de actualizar; una que retira algo que la versión anterior usa debe ir después.

### 4.5 Espacio en disco e imágenes

Las imágenes `editia-app:latest` y `editia-app:rollback` deben quedarse.
Para liberar espacio:

```bash
docker image prune -f        # solo imágenes sin etiqueta
docker builder prune -f      # caché de construcción
```

No use `docker volume prune` ni `scripts/deploy-vps.sh cleanup`, que lo ejecuta: en versiones de Docker anteriores a la 23 borra también los volúmenes con nombre que no estén en uso, como los de Grafana y Prometheus con sus contenedores parados.

### 4.6 Rotación de secretos

| Secreto | Dónde cambiarlo | Después |
|---|---|---|
| `OJS_API_KEY` | OJS → perfil del usuario → API | Editar `.env`, `docker compose up -d app` |
| `METRICS_TOKEN` | `.env` | `docker compose up -d app` y configurar el mismo token en Prometheus |
| `GRAFANA_PASSWORD` | Grafana → perfil | La variable solo se aplica al crear Grafana |
| `NEXT_PUBLIC_SUPABASE_*` | Supabase → API | `scripts/upgrade.sh --force` (se incrustan al construir) |
| `VPS_SSH_KEY` | GitHub → Secrets y `~/.ssh/authorized_keys` del VPS | Probar un despliegue manual |

### 4.7 Calendario

| Frecuencia | Tarea |
|---|---|
| Diaria | Revisar el resultado del trabajo `deploy` y de la copia diaria en GitHub Actions |
| Semanal | `scripts/upgrade.sh --status`; `df -h`; copiar `backups/` fuera del servidor |
| Mensual | `apt-get update && apt-get upgrade` y reinicio si lo pide; revisar alertas de Prometheus |
| Cada 60 días | Comprobar la fecha de caducidad del certificado: `openssl x509 -enddate -noout -in nginx/ssl/fullchain.pem` |
| Trimestral | Probar una restauración completa en un servidor de prueba |

---

## 5. Actualización con varios agentes (DeepSeek Harness y Claude Code)

La skill `editia-upgrade` (`.claude/skills/editia-upgrade/SKILL.md`) organiza la actualización con varios agentes.
`upgrade.sh` sigue haciendo el trabajo; los agentes comprueban, resumen, piden autorización y verifican.

| Agente | Herramientas | Tarea |
|---|---|---|
| Principal | Todas | Coordina, pide autorización y es el único que ejecuta `upgrade.sh` |
| `preflight` | Solo lectura | `upgrade.sh --check` por SSH; devuelve `GO` o `NO-GO` |
| `release-notes` | Solo lectura | Resume los commits y señala migraciones y variables nuevas |
| `verifier` | Solo lectura | `--status`, logs y salud pública después de actualizar |

`preflight` y `release-notes` trabajan en paralelo.
La skill no actualiza sin una autorización explícita que nombre el servidor, y espera confirmación si hay migraciones.

### 5.1 DeepSeek Harness (`dsh`)

DeepSeek Harness es el agente de programación de DeepSeek (paquete npm `@deepseek-ai/dsh`, licencia MIT).
Está en versión preliminar: la última publicada el 2026-11-06 es `0.2.2-rc.1`.

Instalación en el equipo del operador, no en el VPS:

```bash
node --version                               # debe ser 24.9.0 o superior
npm install -g @deepseek-ai/dsh@0.2.2-rc.1   # fije la versión; es una versión preliminar
dsh --version
export DEEPSEEK_API_KEY='sk-…'               # clave de https://platform.deepseek.com/
```

En modo `headless`, `dsh` busca `DEEPSEEK_API_KEY` en el entorno, después en `.env` de la carpeta desde la que se lanza y después en `$DSH_HOME/.env`.
No guarde esa clave en el `.env` del proyecto.

Qué lee `dsh` de este repositorio sin configuración adicional:

- `CLAUDE.md` (y `AGENTS.md` si existiera) como instrucciones del proyecto.
- Las skills de `.agents/skills/`, que son enlaces a `.claude/skills/`: `editia-upgrade`, `write-draft` y las seis de Obsidian.
- Las herramientas de varios agentes `subagent`, `subagent_fork`, `send_message`, `list_agents` e `interrupt_agent`.

En Windows, los enlaces de `.agents/skills/` necesitan `git config core.symlinks true` y el modo de desarrollador activado antes de clonar.
Si no, `dsh` no verá las skills.

Uso desde la raíz del repositorio, con la clave del VPS ya en `~/.ssh/known_hosts`:

```bash
export EDITIA_SSH=root@203.0.113.10

# Solo comprobación previa (no cambia nada)
dsh --profile headless --permission-mode read-only \
  "Usa la skill editia-upgrade hasta el paso 2: comprobación previa y notas de versión para $EDITIA_SSH."

# Actualización completa; la autorización va en la propia tarea porque headless no admite preguntas
dsh --profile headless --permission-mode workspace-write \
  "Usa la skill editia-upgrade para actualizar $EDITIA_SSH a main. Autorizo la actualización en $EDITIA_SSH. Las migraciones pendientes ya están aplicadas."
```

Para trabajar de forma interactiva, use `dsh web`, añada la carpeta del repositorio como espacio de trabajo y pida «usa la skill editia-upgrade».
En la interfaz web, **Use Agent Teams** en el menú del modelo añade un tablero de tareas compartido entre los agentes; es opcional.

`--permission-mode` solo limita qué archivos locales puede modificar el agente; no limita la red, así que `ssh` funciona en los tres modos.
`read-only` basta para la comprobación previa.

Qué se ha comprobado el 2026-11-06 con `dsh 0.2.2-rc.1` y Node 24.22.2, usando un servidor de prueba que imita la API de DeepSeek:
`dsh` cargó `CLAUDE.md`, ofreció las 8 skills del proyecto y las herramientas de subagentes, y usó el modelo `deepseek-flash` con esfuerzo `high`.
Sin la carpeta `.agents/skills` no apareció ninguna skill.
No se ha probado con la API real de DeepSeek ni contra un VPS real.

### 5.2 Claude Code

En Claude Code la misma skill se invoca con `/editia-upgrade root@203.0.113.10`.
Claude Code lee `.claude/skills/` directamente y usa su herramienta de agentes para los subagentes.

Claude Code también admite `ANTHROPIC_BASE_URL`, y DeepSeek ofrece una API compatible en `https://api.deepseek.com/anthropic`.
Anthropic advierte que no da soporte a Claude Code con modelos que no sean Claude; para usar modelos de DeepSeek, este manual recomienda `dsh`.

---

## 6. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `upgrade.sh` termina con «Hay cambios locales en archivos versionados» | Alguien editó un archivo en el servidor | `git diff` para verlo; guárdelo fuera y `git checkout -- <archivo>` |
| `upgrade.sh` termina con «Hay otra actualización en curso» (salida 3) | Otro despliegue en marcha | Espere; si no hay ninguno, compruebe procesos con `ps aux \| grep upgrade` |
| Vuelta atrás automática en cada actualización | La versión nueva no arranca o no responde a tiempo | `docker compose logs --tail 200 app`; si solo es lenta, `HEALTH_TIMEOUT=300 scripts/upgrade.sh` |
| Salida 4 | La versión anterior tampoco queda sana | `docker compose logs app`; revise `.env`, disco (`df -h`) y memoria (`free -m`); `GIT_SHA=$(git rev-parse HEAD) docker compose up -d --build app` |
| `deploy` de GitHub en verde pero el servidor no cambia | Faltan `VPS_HOST` o `VPS_SSH_KEY` | Sección 2.7 |
| `deploy` falla al conectar | Clave SSH o puerto | Pruebe `ssh -i <clave> -p <puerto> <usuario>@<host>` desde otra máquina |
| La pestaña OJS dice «no configurado» | Faltan `OJS_BASE_URL` u `OJS_API_KEY` | Sección 2.3 y `docker compose up -d app` |
| Cambié `NEXT_PUBLIC_*` y no se nota | Se incrustan al construir | `scripts/upgrade.sh --force` |
| Prometheus marca la app como caída | Prometheus no envía `METRICS_TOKEN` | Sección 7, punto 4 |
| El navegador avisa de certificado caducado | La renovación automática falla | `docker compose stop nginx && certbot renew && docker compose start nginx` |
| Los artículos «desaparecen» | Los datos viven en el navegador | Sección 3.2 |
| `dsh` no muestra las skills | Enlaces de `.agents/skills` rotos (Windows) o se lanzó fuera del repositorio | Sección 5.1 |
| `dsh` falla con `MISSING_CREDENTIAL` | Falta `DEEPSEEK_API_KEY` | `export DEEPSEEK_API_KEY=…` |

---

## 7. Problemas conocidos y limitaciones

Encontrados al revisar el código el 2026-11-06.
No están corregidos en esta versión salvo donde se indica.

1. **Datos solo en el navegador.** El tablero guarda los artículos en `localStorage` (`src/store/articleStore.ts`, persistencia `editorial-workflow-storage`). Las tablas de Supabase de artículos existen pero la app no las usa.
2. **Sin autenticación real.** Solo `/api/metrics` exige token; el inicio de sesión es de demostración y `AuthDialog` no se muestra.
3. **Webhook de OJS sin verificación.** Con secreto, solo comprueba que la cabecera exista, sin HMAC (`src/app/api/webhooks/ojs/route.ts`). El evento borra entradas de una caché en memoria que nada rellena.
4. **Monitorización.**
   - Prometheus lee `/api/metrics` sin token, así que la alerta `ApplicationDown` salta (`monitoring/prometheus.yml`, `docker-compose.yml`).
   - El objetivo `redis` no tiene exportador y `cadvisor` no existe en `docker-compose.yml`.
   - Las métricas de artículos son valores fijos.
5. **Exposición de puertos.**
   - Redis (6379) se publica sin contraseña y Prometheus tiene la API de administración activada.
   - Los puertos publicados por Docker no pasan por ufw.
   - Cierre 6379, 9090 y 3001 en el cortafuegos del proveedor o quite esos `ports:` de `docker-compose.yml`.
6. **Renovación de certificados.** La tarea programada usa `certbot renew` en modo standalone mientras nginx ocupa el puerto 80, así que falla (`scripts/setup-ssl.sh`).
7. **`backup.sh` y la copia diaria.**
   - La copia diaria de GitHub Actions usa nombres de archivo distintos de los que espera `backup.sh restore`, que entonces no restaura nada.
   - La restauración de Redis no tiene efecto con AOF activado.
   - La restauración de Grafana copia a una ruta equivocada.
   - Use las copias de `upgrade.sh` y `pg_dump` (sección 4.2).
8. **Migración no idempotente.** `001_initial_schema.sql` falla si se ejecuta dos veces, y `setup-supabase.sh` no se detiene en el primer error.
9. **`deploy-vps.sh cleanup`** ejecuta `docker volume prune -f`.
10. **Redis no se usa.** `src/lib/redis.ts` guarda la URL pero usa una caché en memoria del proceso.
11. **Documentación anterior desactualizada.**
    - `MANUAL-COMPLETO.md` y `DEPLOYMENT.md` mencionan el perfil `with-cache`, que no existe.
    - Mencionan las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`; el código lee `NEXT_PUBLIC_*`.
    - Mencionan `RESEND_API_KEY`, que no se usa.
    - Describen webhooks salientes y sincronización automática, que no están conectados.

Corregido en esta versión:

- `setup-vps.sh` copiaba un `.env.example` que no existía y la instalación se detenía; ahora usa `config/env.template`.
- El despliegue de GitHub Actions hacía `git pull` sin comprobar errores y borraba la imagen anterior con `docker image prune`. Ahora usa `upgrade.sh`, con vuelta atrás y sin despliegues simultáneos.
- `/api/health` devolvía siempre `1.0.0`; ahora devuelve el commit desplegado.
- El contexto de construcción de Docker incluía `.git` y `backups/` (con copias de `.env`); `.dockerignore` los excluye.

---

## 8. Referencia

### 8.1 Variables de entorno

| Variable | Uso | Si falta |
|---|---|---|
| `OJS_BASE_URL`, `OJS_API_KEY` | Conexión con OJS | Pestaña OJS «no configurado»; `/api/ojs/status` responde `connected: false` y las demás rutas `/api/ojs/*`, 503 |
| `OJS_JOURNAL_PATH` | Revista en OJS | `index` |
| `OJS_WEBHOOK_SECRET` | Cabecera esperada en el webhook | El webhook acepta todo |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (al construir) | Modo demostración |
| `NEXT_PUBLIC_APP_URL` | URL pública | Solo afecta a la información del webhook |
| `METRICS_TOKEN` | Token de `/api/metrics` | `docker-compose.yml` pone un valor público por defecto |
| `GRAFANA_USER`, `GRAFANA_PASSWORD`, `GRAFANA_ROOT_URL` | Grafana | Contraseña por defecto publicada |
| `SUPABASE_DB_URL` | `pg_dump` en `upgrade.sh`, `psql` | La base de datos no se copia |
| `BACKUP_REMOTE_HOST`, `BACKUP_REMOTE_PATH`, `AWS_S3_BUCKET` | `backup.sh remote` | Sin copia remota |
| `GIT_SHA` | Commit incrustado en la imagen (lo pone `upgrade.sh`) | `/api/health` devuelve `unknown` |
| `DEEPSEEK_API_KEY` | `dsh`, en el equipo del operador | `MISSING_CREDENTIAL` |
| `EDITIA_SSH` | Destino de la skill `editia-upgrade` | La skill lo pregunta |

### 8.2 Scripts

| Script | Uso |
|---|---|
| `scripts/setup-vps.sh` | Preparar un servidor nuevo |
| `scripts/upgrade.sh` | Actualizar, comprobar, estado y vuelta atrás |
| `scripts/setup-ssl.sh <dominio>` | Certificado y nginx con HTTPS |
| `scripts/deploy-vps.sh` | `start`, `start-prod`, `stop`, `restart`, `logs`, `status` (no use `update` ni `cleanup`) |
| `scripts/backup.sh` | `local`, `remote`, `restore`, `list` (ver sección 7, punto 7) |
| `scripts/setup-supabase.sh` | Muestra o aplica el SQL de `supabase/migrations/` |

### 8.3 Archivos del servidor

| Ruta | Contenido |
|---|---|
| `/opt/editorial-workflow` | Instalación (clon del repositorio) |
| `/opt/editorial-workflow/.env` | Configuración y secretos (permisos 600) |
| `/opt/editorial-workflow/backups/` | Copias de `upgrade.sh` y `backup.sh` |
| `/opt/editorial-workflow/.upgrade/` | Estado de `upgrade.sh`: `history.log`, `previous_sha`, `lock` |
| `/opt/editorial-workflow/nginx/ssl/` | Certificados |

---

## 9. Fuentes

Comprobadas el 2026-11-06.

- Paquete `@deepseek-ai/dsh` en el registro de npm (versión `0.2.2-rc.1`, licencia MIT, requisito `node >=24.9.0`): https://www.npmjs.com/package/@deepseek-ai/dsh
- Repositorio de DeepSeek Harness, commit `fcc0ad4` del 2026-11-04, consultado en `apps/cli/README.md`, `docs/user/guide/providers.md`, `packages/bundle/headless/README.md`, `packages/context/agent-instructions/README.md`, `packages/skill/skill-filesystem/README.md`, `packages/team/agent-team/README.md` y `packages/sandbox/sandbox-policy/README.md`: https://github.com/deepseek-ai/deepseek-harness
- DeepSeek, uso de la API de Anthropic (URL base `https://api.deepseek.com/anthropic`); solo vista en resultados de búsqueda, la página no se pudo abrir desde el entorno de trabajo: https://api-docs.deepseek.com/guides/anthropic_api
- Anthropic, variables de entorno de Claude Code: https://code.claude.com/docs/en/env-vars
- Anthropic, Claude Code con pasarelas LLM (no se da soporte a modelos que no sean Claude): https://code.claude.com/docs/en/llm-gateway
- Código de este repositorio, revisado archivo por archivo: `docker-compose.yml`, `Dockerfile`, `scripts/*.sh`, `.github/workflows/ci-cd.yaml`, `src/app/api/**`, `src/lib/**`, `src/store/**`, `supabase/migrations/001_initial_schema.sql`, `monitoring/**`.
