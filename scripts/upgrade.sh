#!/usr/bin/env bash
#
# Actualización segura de EDITIA en el VPS.
#
# Hace, en este orden: comprobaciones previas, copia de seguridad, actualización
# del código, construcción de la imagen (sin parar el servicio), despliegue,
# comprobación de salud y, si algo falla, vuelta atrás automática a la versión
# anterior (código + imagen).
#
# Uso:
#   scripts/upgrade.sh                  actualiza a la última versión de la rama
#   scripts/upgrade.sh --check          solo informa: qué cambiaría, migraciones, salud
#   scripts/upgrade.sh --status         versión desplegada, anterior y estado de salud
#   scripts/upgrade.sh --rollback       vuelve a la versión anterior registrada
#
# Opciones:
#   --branch <rama>     rama a desplegar (por defecto: main)
#   --dir <ruta>        instalación (por defecto: la raíz git actual o /opt/editorial-workflow)
#   --skip-backup       no crear copia de seguridad (no recomendado)
#   --force             reconstruir aunque no haya cambios
#
# Variables opcionales:
#   HEALTH_URL       URL de salud (por defecto http://localhost:3000/api/health)
#   HEALTH_TIMEOUT   segundos de espera de salud (por defecto 180)
#   KEEP_BACKUPS     copias de actualización que se conservan (por defecto 10)
#   SUPABASE_DB_URL  si está definida y existe pg_dump, la copia incluye la base de datos
#
# Códigos de salida: 0 correcto, 1 error (servicio sin cambios o restaurado),
#                    2 uso incorrecto, 3 otra actualización en curso,
#                    4 fallo de salud tras la vuelta atrás (requiere intervención).

set -Eeuo pipefail

BRANCH="main"
APP_DIR=""
MODE="upgrade"
SKIP_BACKUP=0
FORCE=0

SERVICE="app"
CONTAINER="editorial-app"
IMAGE="editia-app"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
# Archivos versionados que el propio servidor modifica (setup-ssl.sh reescribe nginx.conf).
# Se conservan tal como están en el servidor durante la actualización.
PRESERVE=("nginx/nginx.conf")

log()  { printf '%s [upgrade] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
warn() { log "AVISO: $*"; }
die()  { log "ERROR: $*"; exit "${2:-1}"; }

usage() { sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)      BRANCH="${2:?falta la rama}"; shift 2 ;;
    --dir)         APP_DIR="${2:?falta la ruta}"; shift 2 ;;
    --check)       MODE="check"; shift ;;
    --status)      MODE="status"; shift ;;
    --rollback)    MODE="rollback"; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    --force)       FORCE=1; shift ;;
    -h|--help)     usage ;;
    *)             log "Opción desconocida: $1"; usage ;;
  esac
done

if [[ -z "$APP_DIR" ]]; then
  APP_DIR="$(git rev-parse --show-toplevel 2>/dev/null || echo /opt/editorial-workflow)"
fi
cd "$APP_DIR" 2>/dev/null || die "No existe el directorio de instalación: $APP_DIR" 2
[[ -d .git ]] || die "$APP_DIR no es un repositorio git" 2
[[ -f docker-compose.yml ]] || die "No hay docker-compose.yml en $APP_DIR" 2

STATE_DIR="$APP_DIR/.upgrade"
mkdir -p "$STATE_DIR"

if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  die "Docker Compose no está instalado" 2
fi

# ---------------------------------------------------------------- utilidades

http_get() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 5 "$1"
  else
    wget -q -T 5 -O - "$1"
  fi
}

container_health() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$CONTAINER" 2>/dev/null || echo "missing"
}

# Espera a que el contenedor esté sano y la URL de salud responda.
# $1 = commit esperado (opcional). Falla si la app informa de otro commit.
wait_healthy() {
  local expected="${1:-}" deadline body state
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  log "Esperando salud (máx. ${HEALTH_TIMEOUT}s): $HEALTH_URL"
  while (( $(date +%s) < deadline )); do
    state="$(container_health)"
    case "$state" in
      unhealthy|exited|dead|missing)
        log "Estado del contenedor: $state"; return 1 ;;
    esac
    if body="$(http_get "$HEALTH_URL" 2>/dev/null)" && [[ "$body" == *'"healthy"'* ]]; then
      if [[ "$state" == "healthy" || "$state" == "running" ]]; then
        local reported
        reported="$(grep -oE '"version":"[0-9a-f]{40}"' <<<"$body" | grep -oE '[0-9a-f]{40}' || true)"
        if [[ -n "$expected" && -n "$reported" && "$reported" != "$expected" ]]; then
          log "La app responde con el commit ${reported:0:7}, se esperaba ${expected:0:7}"
          sleep 5; continue
        fi
        log "Servicio sano (contenedor: $state${reported:+, commit ${reported:0:7}})"
        return 0
      fi
    fi
    sleep 5
  done
  log "Tiempo de espera agotado; último estado del contenedor: $(container_health)"
  return 1
}

changed_migrations() {
  git diff --name-only "$1" "$2" -- supabase/migrations 2>/dev/null || true
}

# Modificaciones locales en archivos versionados que no sabemos conservar.
unexpected_local_changes() {
  local f p keep
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    keep=0
    for p in "${PRESERVE[@]}"; do [[ "$f" == "$p" ]] && keep=1; done
    (( keep )) || echo "$f"
  done < <(git diff --name-only HEAD)
}

save_preserved() {
  local p
  PRESERVE_TMP="$(mktemp -d)"
  for p in "${PRESERVE[@]}"; do
    if [[ -f "$p" ]] && ! git diff --quiet HEAD -- "$p" 2>/dev/null; then
      mkdir -p "$PRESERVE_TMP/$(dirname "$p")"
      cp -p "$p" "$PRESERVE_TMP/$p"
      git checkout -q -- "$p"
    fi
  done
}

restore_preserved() {
  [[ -n "${PRESERVE_TMP:-}" && -d "$PRESERVE_TMP" ]] || return 0
  ( cd "$PRESERVE_TMP" && find . -type f -print0 ) | while IFS= read -r -d '' f; do
    cp -p "$PRESERVE_TMP/$f" "$APP_DIR/$f"
  done
}

checkout_sha() {
  # Deja la rama local apuntando a $1 conservando los archivos propios del servidor.
  save_preserved
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout -q "$BRANCH"
  else
    git checkout -q -b "$BRANCH" "$1"
  fi
  git reset -q --hard "$1"
  restore_preserved
}

record() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$STATE_DIR/history.log"; }

make_backup() {
  local sha="$1" ts name dir
  ts="$(date '+%Y%m%d-%H%M%S')"
  name="upgrade-$ts-${sha:0:7}"
  dir="$APP_DIR/backups/$name"
  ( umask 077; mkdir -p "$dir" )
  log "Copia de seguridad en backups/$name.tar.gz"
  echo "$sha" > "$dir/git-sha"
  git diff HEAD > "$dir/local-changes.diff" || true
  [[ -f .env ]] && cp -p .env "$dir/env"
  [[ -d nginx ]] && cp -rp nginx "$dir/nginx"
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    if command -v pg_dump >/dev/null 2>&1; then
      log "Volcando la base de datos de Supabase (pg_dump)"
      if ! pg_dump --no-owner --no-privileges -Fc "$SUPABASE_DB_URL" > "$dir/supabase.dump"; then
        rm -rf "$dir"
        die "pg_dump falló; no se continúa sin copia de la base de datos (el servicio no se ha tocado)"
      fi
    else
      warn "SUPABASE_DB_URL está definida pero pg_dump no está instalado: la base de datos NO se copia"
    fi
  else
    warn "SUPABASE_DB_URL no definida: la base de datos de Supabase NO se copia (ver manual)"
  fi
  ( umask 077; tar -czf "$dir.tar.gz" -C "$APP_DIR/backups" "$name" )
  rm -rf "$dir"
  # Rotación: conserva las KEEP_BACKUPS más recientes de este tipo.
  find "$APP_DIR/backups" -maxdepth 1 -name 'upgrade-*.tar.gz' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | tail -n +"$(( KEEP_BACKUPS + 1 ))" | cut -d' ' -f2- | xargs -r rm -f
}

deploy_image_tag() {
  # $1 = etiqueta a desplegar sin reconstruir
  docker tag "$IMAGE:$1" "$IMAGE:latest"
  "${DC[@]}" up -d --no-deps --no-build "$SERVICE"
}

# --------------------------------------------------------------- estado/check

show_status() {
  log "Instalación: $APP_DIR (rama $(git rev-parse --abbrev-ref HEAD))"
  log "Commit desplegado: $(git rev-parse --short HEAD) — $(git log -1 --format='%s (%cr)')"
  if [[ -f "$STATE_DIR/previous_sha" ]]; then
    log "Versión anterior: $(cut -c1-7 "$STATE_DIR/previous_sha")"
  fi
  if docker image inspect "$IMAGE:rollback" >/dev/null 2>&1; then
    log "Imagen de vuelta atrás disponible: $IMAGE:rollback"
  else
    log "Imagen de vuelta atrás: no disponible"
  fi
  log "Contenedor $CONTAINER: $(container_health)"
  if body="$(http_get "$HEALTH_URL" 2>/dev/null)"; then log "Salud: $body"; else log "Salud: sin respuesta en $HEALTH_URL"; fi
}

do_check() {
  local old new
  old="$(git rev-parse HEAD)"
  git fetch -q origin "$BRANCH" || die "No se pudo descargar origin/$BRANCH (red, credenciales o rama inexistente)"
  new="$(git rev-parse "origin/$BRANCH")"
  show_status
  if [[ "$old" == "$new" ]]; then
    log "RESULTADO: UP_TO_DATE (ya en ${new:0:7})"
  else
    log "RESULTADO: UPGRADE_AVAILABLE ${old:0:7} -> ${new:0:7}"
    git log --oneline "$old..$new" | sed 's/^/    /'
  fi
  local migs; migs="$(changed_migrations "$old" "$new")"
  [[ -n "$migs" ]] && warn "Migraciones nuevas o cambiadas (se aplican a mano):" && sed 's/^/    /' <<<"$migs"
  local extra; extra="$(unexpected_local_changes)"
  [[ -n "$extra" ]] && warn "Cambios locales que bloquean la actualización:" && sed 's/^/    /' <<<"$extra"
  local free_kb; free_kb="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
  (( free_kb < 2097152 )) && warn "Menos de 2 GB libres en disco ($(( free_kb / 1024 )) MB)"
  return 0
}

# ------------------------------------------------------------- vuelta atrás

rollback_to() {
  # $1 = commit anterior. Restaura código e imagen y espera salud.
  local old="$1"
  log "VUELTA ATRÁS a ${old:0:7}"
  checkout_sha "$old"
  if docker image inspect "$IMAGE:rollback" >/dev/null 2>&1; then
    deploy_image_tag rollback
    if wait_healthy; then
      record "ROLLBACK ok -> ${old:0:7}"
      log "Vuelta atrás completada: el servicio vuelve a ${old:0:7}"
      return 0
    fi
    record "ROLLBACK unhealthy -> ${old:0:7}"
    die "La versión anterior tampoco está sana. Revise: ${DC[*]} logs $SERVICE" 4
  fi
  record "ROLLBACK sin imagen -> ${old:0:7}"
  die "No hay imagen de vuelta atrás; código restaurado a ${old:0:7}. Reconstruya con: ${DC[*]} up -d --build $SERVICE" 4
}

do_manual_rollback() {
  [[ -f "$STATE_DIR/previous_sha" ]] || die "No hay versión anterior registrada"
  local prev; prev="$(cat "$STATE_DIR/previous_sha")"
  [[ -n "$(unexpected_local_changes)" ]] && die "Hay cambios locales en archivos versionados; resuélvalos antes"
  rollback_to "$prev"
}

# --------------------------------------------------------------- actualizar

PHASE="preflight"
OLD_SHA=""
NEW_SHA=""

on_error() {
  local code=$? line="$1"
  trap - ERR
  log "Fallo en la línea $line (fase: $PHASE, código $code)"
  case "$PHASE" in
    code_updated|built)
      log "El servicio no se ha tocado; se restaura el código a ${OLD_SHA:0:7}"
      checkout_sha "$OLD_SHA"
      record "FAILED($PHASE) ${OLD_SHA:0:7} -> ${NEW_SHA:0:7}, servicio intacto"
      exit 1 ;;
    deployed)
      rollback_to "$OLD_SHA"
      record "FAILED(deploy) ${OLD_SHA:0:7} -> ${NEW_SHA:0:7}, revertido"
      exit 1 ;;
  esac
  exit "$code"
}

do_upgrade() {
  command -v git >/dev/null || die "git no está instalado" 2
  [[ -f .env ]] || warn "No existe .env: la app arrancará sin configuración de OJS/Supabase"

  OLD_SHA="$(git rev-parse HEAD)"
  log "Instalación: $APP_DIR — versión actual ${OLD_SHA:0:7}"
  git fetch -q origin "$BRANCH" || die "No se pudo descargar origin/$BRANCH (red, credenciales o rama inexistente)"
  NEW_SHA="$(git rev-parse "origin/$BRANCH")"

  if [[ "$OLD_SHA" == "$NEW_SHA" && "$FORCE" -eq 0 ]]; then
    log "Ya está en la última versión de $BRANCH (${NEW_SHA:0:7}). Nada que hacer."
    return 0
  fi

  local extra; extra="$(unexpected_local_changes)"
  if [[ -n "$extra" ]]; then
    die "Hay cambios locales en archivos versionados (guárdelos o descártelos antes):
$extra"
  fi

  local migs; migs="$(changed_migrations "$OLD_SHA" "$NEW_SHA")"
  if [[ -n "$migs" ]]; then
    warn "Esta versión trae migraciones de base de datos; aplíquelas según el manual:"
    sed 's/^/    /' <<<"$migs"
  fi

  if (( SKIP_BACKUP )); then
    warn "Sin copia de seguridad (--skip-backup)"
  else
    make_backup "$OLD_SHA"
  fi

  # Imagen de la versión en servicio, para poder volver atrás.
  if docker inspect "$CONTAINER" >/dev/null 2>&1; then
    docker tag "$(docker inspect -f '{{.Image}}' "$CONTAINER")" "$IMAGE:rollback"
    log "Imagen actual guardada como $IMAGE:rollback"
  else
    warn "El contenedor $CONTAINER no existe: no habrá vuelta atrás de imagen"
  fi
  echo "$OLD_SHA" > "$STATE_DIR/previous_sha"

  trap 'on_error $LINENO' ERR

  PHASE="code_updated"
  log "Actualizando código ${OLD_SHA:0:7} -> ${NEW_SHA:0:7}"
  checkout_sha "$NEW_SHA"
  for p in "${PRESERVE[@]}"; do
    if ! git diff --quiet "$OLD_SHA" "$NEW_SHA" -- "$p" 2>/dev/null; then
      warn "$p cambió en el repositorio pero se conserva la versión del servidor; revise: git diff HEAD -- $p"
    fi
  done

  log "Construyendo la imagen (el servicio actual sigue en marcha)"
  GIT_SHA="$NEW_SHA" "${DC[@]}" build "$SERVICE"
  PHASE="built"

  log "Desplegando la nueva versión"
  PHASE="deployed"
  "${DC[@]}" up -d --no-deps --no-build "$SERVICE"

  if ! wait_healthy "$NEW_SHA"; then
    "${DC[@]}" logs --tail 50 "$SERVICE" || true
    false   # dispara on_error -> vuelta atrás
  fi

  trap - ERR
  PHASE="done"
  record "OK ${OLD_SHA:0:7} -> ${NEW_SHA:0:7}"
  log "Actualización completada: ${NEW_SHA:0:7} en servicio"
  log "Para volver a ${OLD_SHA:0:7}: scripts/upgrade.sh --rollback"
}

# ------------------------------------------------------------------ principal

case "$MODE" in
  status) show_status; exit 0 ;;
  check)  do_check; exit 0 ;;
esac

# Un solo proceso de actualización o vuelta atrás a la vez.
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/lock"
  flock -n 9 || die "Hay otra actualización en curso" 3
else
  warn "flock no disponible: no se impide que dos actualizaciones se solapen"
fi

case "$MODE" in
  rollback) do_manual_rollback ;;
  upgrade)  do_upgrade ;;
esac
