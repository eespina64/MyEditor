# Guía de puesta en marcha en el VPS — EDITIA

Versión: 2026-11-06.
Esta guía lleva EDITIA desde la rama de trabajo hasta un despliegue automático en su VPS, paso a paso, con la comprobación que cierra cada paso.
Los detalles de operación y mantenimiento están en [MANUAL-INSTALACION-OPERACION-MANTENIMIENTO.md](MANUAL-INSTALACION-OPERACION-MANTENIMIENTO.md).

| Paso | Dónde | Resultado |
|---|---|---|
| 1. Fusionar el pull request en `main` | GitHub | `main` contiene `upgrade.sh` y el despliegue nuevo |
| 2. Preparar el VPS | VPS | EDITIA en marcha y sana en el servidor |
| 3. Crear la clave SSH de despliegue | Su equipo y VPS | GitHub puede entrar en el VPS solo con esa clave |
| 4. Guardar los secretos en GitHub | GitHub | El trabajo `deploy` ya no se salta |
| 5. Primer despliegue automático | GitHub y VPS | Cada push a `main` actualiza el servidor |
| 6. DeepSeek Harness en su equipo | Su equipo | Primera ejecución real de los agentes |
| 7. Endurecer el servidor | VPS | Puertos internos cerrados y contraseñas propias |

---

## 0. Qué necesita

| Requisito | Para qué |
|---|---|
| Un VPS con Ubuntu 22.04 LTS (recomendado), su IP y acceso `root` por SSH | Pasos 2 a 5 |
| Permiso de administrador en el repositorio `eespina64/MyEditor` | Pasos 1 y 4 |
| Un equipo con terminal: Linux, macOS o Windows con WSL | Pasos 3 y 6 |
| Un dominio apuntando a la IP del VPS (opcional) | HTTPS (paso 7) |
| Una cuenta en https://platform.deepseek.com/ con saldo | Paso 6 |

En los ejemplos, sustituya `203.0.113.10` por la IP de su VPS y `editorial.su-dominio.edu` por su dominio.

---

## 1. Fusionar el pull request en `main`

El despliegue nuevo solo existe en la rama `claude/project-deployment-b7g6ep` hasta que se fusione.

1. Abra el pull request en https://github.com/eespina64/MyEditor/pulls.
2. Espere a que las comprobaciones terminen y revise que `test` y `build` están en verde.
3. Pulse **Merge pull request** y después **Confirm merge**.

Qué pasa a continuación:
GitHub Actions ejecuta `CI/CD Pipeline` sobre `main` con `test`, `build` y `deploy`.
Mientras no haya secretos del VPS (paso 4), `deploy` termina en verde sin desplegar y su registro dice «VPS deployment skipped - secrets not configured».

**Comprobación:** en **Actions**, la ejecución de `main` termina en verde.

---

## 2. Preparar el VPS

Si EDITIA ya está instalado en `/opt/editorial-workflow`, entre en el servidor y actualícelo con las mismas órdenes que usa el despliegue automático; después salte al apartado 2.4 para comprobarlo:

```bash
cd /opt/editorial-workflow
git fetch -q origin main
git show origin/main:scripts/upgrade.sh > /tmp/editia-upgrade.sh
bash /tmp/editia-upgrade.sh --dir /opt/editorial-workflow --branch main
```

No use `git pull`: falla si `setup-ssl.sh` ya modificó `nginx/nginx.conf`, mientras que `upgrade.sh` conserva esa versión local.

### 2.1 Entrar e instalar

Desde su equipo:

```bash
ssh root@203.0.113.10
```

Ya en el VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/eespina64/MyEditor/main/scripts/setup-vps.sh -o setup-vps.sh
less setup-vps.sh            # revíselo antes de ejecutarlo
bash setup-vps.sh
```

El script actualiza el sistema, instala `curl`, `git`, `wget`, Docker y Docker Compose, configura el cortafuegos y clona el repositorio en `/opt/editorial-workflow`.
Al final crea `/opt/editorial-workflow/.env` desde `config/env.template`.

### 2.2 Crear las contraseñas propias

Genere valores aleatorios y anótelos en su gestor de contraseñas:

```bash
openssl rand -hex 32        # para METRICS_TOKEN
openssl rand -base64 24     # para GRAFANA_PASSWORD
```

### 2.3 Configurar `.env`

```bash
cd /opt/editorial-workflow
nano .env
```

Rellene como mínimo `METRICS_TOKEN` y `GRAFANA_PASSWORD` con los valores anteriores.
Si va a conectar OJS o Supabase, rellene también `OJS_BASE_URL`, `OJS_API_KEY`, `OJS_JOURNAL_PATH`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Guarde con `Ctrl+O`, `Enter`, y salga con `Ctrl+X`.

```bash
chmod 600 .env
```

### 2.4 Primer arranque

```bash
cd /opt/editorial-workflow
GIT_SHA=$(git rev-parse HEAD) docker compose up -d --build
```

La primera construcción tarda varios minutos.

**Comprobación:**

```bash
curl -s http://localhost:3000/api/health
# {"status":"healthy","timestamp":"…","version":"<commit de 40 caracteres>"}
scripts/upgrade.sh --status
```

`--status` debe mostrar el commit desplegado y `Contenedor editorial-app: healthy`.
«Imagen de vuelta atrás: no disponible» es normal en la primera instalación; aparece después de la primera actualización.

---

## 3. Crear la clave SSH de despliegue

GitHub Actions necesita una clave propia para entrar en el VPS.
Use una clave nueva solo para esto, no su clave personal.

### 3.1 Generarla en su equipo

```bash
ssh-keygen -t ed25519 -f ~/.ssh/editia_deploy -N "" -C "github-actions-editia"
```

Se crean dos archivos: `~/.ssh/editia_deploy` (privada, irá a GitHub) y `~/.ssh/editia_deploy.pub` (pública, irá al VPS).
La clave privada no lleva contraseña porque GitHub Actions no puede escribirla; protéjala como un secreto.

### 3.2 Autorizarla en el VPS

```bash
ssh-copy-id -i ~/.ssh/editia_deploy.pub root@203.0.113.10
```

**Comprobación:** esta orden debe entrar sin pedir contraseña y mostrar el estado:

```bash
ssh -i ~/.ssh/editia_deploy root@203.0.113.10 'cd /opt/editorial-workflow && scripts/upgrade.sh --status'
```

### 3.3 Obtener la huella del servidor

La huella permite a GitHub comprobar que se conecta a su VPS y no a un impostor.
Sin ella, la conexión de despliegue no verifica la identidad del servidor.

En el VPS:

```bash
for t in ecdsa rsa ed25519; do
  f=/etc/ssh/ssh_host_${t}_key.pub
  [ -f "$f" ] && { ssh-keygen -l -f "$f" | cut -d ' ' -f2; break; }
done
# SHA256:AbCdEf…
```

El orden importa: el cliente SSH de la acción de GitHub negocia primero ECDSA, después RSA y por último Ed25519.
Si usa la huella de otro tipo de clave, el despliegue fallará con «fingerprint mismatch».

---

## 4. Guardar los secretos en GitHub

En https://github.com/eespina64/MyEditor: **Settings → Secrets and variables → Actions → New repository secret**.
Cree uno por fila; el nombre debe coincidir exactamente.

| Nombre | Valor |
|---|---|
| `VPS_HOST` | `203.0.113.10` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` (o su puerto SSH) |
| `VPS_SSH_KEY` | El contenido completo de `~/.ssh/editia_deploy`, incluidas las líneas `-----BEGIN OPENSSH PRIVATE KEY-----` y `-----END OPENSSH PRIVATE KEY-----` |
| `VPS_FINGERPRINT` | La huella del apartado 3.3, por ejemplo `SHA256:AbCdEf…` |
| `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` | Opcionales, para recibir avisos de despliegue |

Para ver el contenido de la clave privada y copiarlo:

```bash
cat ~/.ssh/editia_deploy
```

Con la CLI de GitHub (`gh`), en lugar de la web:

```bash
gh secret set VPS_HOST --repo eespina64/MyEditor --body "203.0.113.10"
gh secret set VPS_USER --repo eespina64/MyEditor --body "root"
gh secret set VPS_PORT --repo eespina64/MyEditor --body "22"
gh secret set VPS_SSH_KEY --repo eespina64/MyEditor < ~/.ssh/editia_deploy
gh secret set VPS_FINGERPRINT --repo eespina64/MyEditor --body "SHA256:AbCdEf…"
```

**Comprobación:** la lista de **Repository secrets** muestra los cinco nombres.
GitHub no deja ver los valores después de guardarlos.

---

## 5. Primer despliegue automático

1. En GitHub: **Actions → CI/CD Pipeline → Run workflow**.
2. Elija la rama `main` y `action: deploy`, y pulse **Run workflow**.
3. Abra la ejecución y, dentro del trabajo `deploy`, el paso **Deploy to VPS**.

Si el servidor ya tiene la última versión de `main`, el registro termina así:

```
[upgrade] Ya está en la última versión de main (<commit>). Nada que hacer.
editorial-app Up … (healthy)
```

Si había una versión nueva, verá la copia de seguridad, la construcción y al final:

```
[upgrade] Servicio sano (contenedor: healthy, commit <nuevo>)
[upgrade] Actualización completada: <nuevo> en servicio
```

Las dos salidas se han reproducido el 2026-11-06 ejecutando el mismo script del trabajo `deploy` contra una instalación de prueba.

**Comprobación en el VPS:**

```bash
cd /opt/editorial-workflow && scripts/upgrade.sh --status && tail -3 .upgrade/history.log
```

A partir de aquí, cada push o fusión en `main` despliega solo.
Si la versión nueva no arranca, `upgrade.sh` vuelve a la anterior y el trabajo `deploy` termina en rojo.

---

## 6. DeepSeek Harness en su equipo (primera ejecución real)

Esto se hace en su equipo, no en el VPS.
DeepSeek Harness (`dsh`) ejecutará la skill `editia-upgrade`, que entra en el VPS por SSH.

### 6.1 Instalar Node 24 y `dsh`

`dsh` necesita Node 24.9.0 o superior.
Con nvm (https://github.com/nvm-sh/nvm):

```bash
nvm install 24
node --version                                # v24.x, igual o superior a v24.9.0
npm install -g @deepseek-ai/dsh@0.2.2-rc.1    # versión preliminar: fíjela
dsh --version                                 # 0.2.2-rc.1
```

### 6.2 Crear y cargar la clave de DeepSeek

1. En https://platform.deepseek.com/, cree una clave de API y cópiela.
2. Revise el saldo y los precios de su cuenta en esa misma plataforma antes de usarla.
3. Cárguela en la terminal sin dejarla en el historial:

```bash
read -rs DEEPSEEK_API_KEY && export DEEPSEEK_API_KEY
# pegue la clave y pulse Enter (no se muestra)
```

No la guarde en el `.env` del proyecto ni la suba al repositorio.
Para no escribirla cada vez, guárdela en su gestor de contraseñas o en el llavero del sistema.

### 6.3 Preparar el repositorio y el acceso SSH

```bash
git clone https://github.com/eespina64/MyEditor.git && cd MyEditor
ls -l .agents/skills | head -3        # deben ser enlaces (->) a ../../.claude/skills/…
```

Registre la clave del servidor y compruebe que coincide con la del VPS:

```bash
ssh-keyscan -t ecdsa,ed25519 203.0.113.10 >> ~/.ssh/known_hosts
ssh-keygen -l -F 203.0.113.10                         # compárela con 3.3
ssh -o BatchMode=yes root@203.0.113.10 'echo ok'      # debe responder "ok" sin preguntar nada
export EDITIA_SSH=root@203.0.113.10
```

Use su clave SSH personal para esto, no la de GitHub Actions.

### 6.4 Prueba 1: la clave funciona (sin tocar el servidor)

```bash
dsh --profile headless --permission-mode read-only \
  "Lista las skills de este proyecto y resume CLAUDE.md en tres líneas."
```

Correcto: la respuesta nombra `editia-upgrade`, `write-draft` y las demás skills del proyecto.
Si falla con `MISSING_CREDENTIAL`, la variable `DEEPSEEK_API_KEY` no está en esa terminal; si falla con `AUTH`, la clave no es válida.

### 6.5 Prueba 2: comprobación previa contra el VPS

```bash
dsh --profile headless --permission-mode workspace-write \
  "Usa la skill editia-upgrade hasta el paso 2: comprobación previa y notas de versión para $EDITIA_SSH."
```

Correcto: la respuesta incluye la versión instalada, `UP_TO_DATE` o `UPGRADE_AVAILABLE`, y un `GO` o `NO-GO` con su motivo.
No cambia nada en el servidor; en su equipo solo hace `git fetch`.

### 6.6 Prueba 3: actualización con agentes (opcional)

Con el despliegue automático del paso 5, normalmente no hace falta.
Úsela para actualizar a mano o para ensayar el procedimiento:

```bash
dsh --profile headless --permission-mode workspace-write \
  "Usa la skill editia-upgrade para actualizar $EDITIA_SSH a main. Autorizo la actualización en $EDITIA_SSH. Las migraciones pendientes ya están aplicadas."
```

Correcto: termina con la tabla de la skill (versión antes y después, código de salida, copia de seguridad, salud, logs).
La frase «Autorizo la actualización en …» es obligatoria: sin ella la skill se detiene antes de actualizar.

Estas tres pruebas son la primera ejecución con la API real de DeepSeek; anote lo que devuelvan.
Hasta ahora `dsh` solo se ha probado con un servidor que imita esa API (manual, sección 5.1).

---

## 7. Endurecer el servidor

Hágalo justo después del paso 5.

### 7.1 Cerrar los puertos internos

`docker-compose.yml` publica la app (3000), Grafana (3001), Prometheus (9090) y Redis (6379) en todas las interfaces.
Publíquelos solo en el propio servidor con un archivo local que Git no sigue y que `upgrade.sh` respeta:

```bash
cd /opt/editorial-workflow
cat > docker-compose.override.yml <<'EOF'
services:
  app:
    ports: !override
      - "127.0.0.1:3000:3000"
  grafana:
    ports: !override
      - "127.0.0.1:3001:3000"
  prometheus:
    ports: !override
      - "127.0.0.1:9090:9090"
  redis:
    ports: !override
      - "127.0.0.1:6379:6379"
EOF
docker compose up -d
ufw delete allow 3000/tcp; ufw delete allow 3001/tcp; ufw delete allow 9090/tcp
```

Comprobado el 2026-11-06 con Docker Compose v5.6:
- Con este archivo y el `docker-compose.yml` del repositorio, `docker compose config` publica los cuatro puertos solo en `127.0.0.1`.
- En una instalación de prueba, el contenedor `app` quedó en `127.0.0.1:3000`, Git vio el archivo como no seguido y `upgrade.sh --check` no lo consideró un cambio local.
nginx llega a la app y a Grafana por la red interna de Docker, así que no le afecta.

Para abrir Grafana o Prometheus desde su equipo, use un túnel SSH:

```bash
ssh -L 3001:localhost:3001 -L 9090:localhost:9090 root@203.0.113.10
# y abra http://localhost:3001 y http://localhost:9090 en su navegador
```

**Comprobación desde otra máquina:** `nmap -p 3000,3001,6379,9090 203.0.113.10` debe mostrar los cuatro como `closed` o `filtered`.

### 7.2 HTTPS

```bash
cd /opt/editorial-workflow
scripts/setup-ssl.sh editorial.su-dominio.edu
docker compose --profile production up -d
```

La renovación automática del certificado tiene un fallo conocido.
Anote en su calendario revisarlo cada 60 días con el procedimiento de la sección 6 del manual.

### 7.3 Copias de la base de datos

Si usa Supabase, exporte su cadena de conexión cuando actualice a mano, para que la copia incluya la base de datos:

```bash
apt-get install -y postgresql-client
export SUPABASE_DB_URL='postgresql://…'    # Supabase → Project Settings → Database
scripts/upgrade.sh
```

Las actualizaciones desde GitHub Actions no tienen esa variable y no copian la base de datos.

---

## 8. Lista de comprobación final

- [ ] Pull request fusionado; la ejecución de `main` en **Actions** está en verde.
- [ ] `curl -s http://localhost:3000/api/health` en el VPS devuelve `healthy` y el commit.
- [ ] `ssh -i ~/.ssh/editia_deploy root@<ip> 'echo ok'` funciona sin contraseña.
- [ ] Los secretos `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY` y `VPS_FINGERPRINT` existen en GitHub.
- [ ] El despliegue manual (paso 5) termina en verde con «Actualización completada» o «Ya está en la última versión».
- [ ] `METRICS_TOKEN` y `GRAFANA_PASSWORD` son propios.
- [ ] `nmap` desde fuera muestra 3000, 3001, 6379 y 9090 cerrados.
- [ ] HTTPS activo, si tiene dominio.
- [ ] `dsh` respondió a las pruebas 1 y 2 del paso 6.

---

## 9. Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| `deploy` en verde pero «VPS deployment skipped» | Falta `VPS_HOST` o `VPS_SSH_KEY` | Paso 4 |
| `ssh: host key fingerprint mismatch` | La huella es de otro tipo de clave o el servidor cambió | Repita 3.3 con el bucle `ecdsa rsa ed25519` y actualice `VPS_FINGERPRINT` |
| `ssh: handshake failed: ssh: unable to authenticate` | La clave privada está incompleta o la pública no está en el VPS | Vuelva a copiar la privada completa (3.1, 4) y a ejecutar `ssh-copy-id` (3.2) |
| `dial tcp …: i/o timeout` | Puerto SSH cerrado o IP incorrecta | Revise `VPS_HOST`, `VPS_PORT` y el cortafuegos del proveedor |
| `[upgrade] ERROR: Docker no responde` | Docker parado en el VPS | `systemctl start docker` |
| `[upgrade] ERROR: Hay cambios locales en archivos versionados` | Alguien editó un archivo del repositorio en el servidor | `git diff`; los ajustes de puertos van en `docker-compose.override.yml` |
| `deploy` en rojo tras «VUELTA ATRÁS» | La versión nueva no arrancó; el servidor sigue en la anterior | `docker compose logs --tail 200 app` en el VPS |
| `dsh` responde `MISSING_CREDENTIAL` | Falta `DEEPSEEK_API_KEY` en esa terminal | 6.2 |
| `dsh` responde `AUTH` o `QUOTA` | Clave inválida o sin saldo | Revise la clave y el saldo en platform.deepseek.com |
| La skill se para pidiendo autorización | Falta la frase «Autorizo la actualización en …» | 6.6 |
| `Host key verification failed` al usar `dsh` | El VPS no está en `known_hosts` | 6.3 |

---

## Fuentes

Comprobadas el 2026-11-06.

- Acción `appleboy/ssh-action` v1.2.2: entradas `fingerprint` y `command_timeout` (`action.yml`) y orden para obtener la huella (`README.md`): https://github.com/appleboy/ssh-action
- Con una huella vacía, la conexión no verifica el servidor: `appleboy/easyssh-proxy` v1.5.0, `easyssh.go` (`ssh.InsecureIgnoreHostKey()` salvo que haya `Fingerprint`), usada por `drone-ssh` v1.8.1: https://github.com/appleboy/easyssh-proxy
- Orden de negociación de claves del servidor (ECDSA, RSA, Ed25519): `golang.org/x/crypto` v0.36.0, `ssh/common.go`, `supportedHostKeyAlgos`: https://github.com/golang/crypto
- DeepSeek Harness: paquete `@deepseek-ai/dsh` (https://www.npmjs.com/package/@deepseek-ai/dsh) y repositorio https://github.com/deepseek-ai/deepseek-harness (credenciales del modo headless en `packages/bundle/headless/README.md`).
- Pruebas propias con Docker 29.8.2 y Docker Compose v5.6: script del trabajo `deploy` contra una instalación de prueba (dos ejecuciones: actualización y «ya al día») y `docker-compose.override.yml` con `!override` en el servicio `app`.
