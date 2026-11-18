#!/usr/bin/env bash
# Ejecuta un script de Blender en modo headless con fallo real en CI.
#
#   run_headless.sh script.py [-- args para el script]
#   run_headless.sh --check-version 5.2
#
# Variables: BLENDER (ruta al binario, por defecto "blender").
set -euo pipefail

BLENDER="${BLENDER:-blender}"

if ! command -v "$BLENDER" >/dev/null 2>&1; then
  echo "error: no se encuentra Blender ('$BLENDER'). Define BLENDER=/ruta/al/binario." >&2
  exit 127
fi

if [[ "${1:-}" == "--check-version" ]]; then
  want="${2:?uso: --check-version <mayor.menor>}"
  # Primera línea de --version: "Blender 5.2.2 LTS" o similar.
  got="$("$BLENDER" --background --factory-startup --version 2>/dev/null | awk '/^Blender /{print $2; exit}')"
  py="$("$BLENDER" --background --factory-startup --python-exit-code 1 \
        --python-expr 'import sys; print("PYVER", "%d.%d" % sys.version_info[:2])' 2>/dev/null \
        | awk '/^PYVER /{print $2; exit}')"
  echo "Blender instalado: ${got:-desconocido} (Python ${py:-?}); objetivo: $want"
  if [[ "$got" != "$want" && "$got" != "$want".* ]]; then
    echo "error: la versión no coincide con el objetivo." >&2
    exit 2
  fi
  exit 0
fi

script="${1:?uso: run_headless.sh script.py [-- args]}"
shift
# Todo lo que va después de "--" llega al script como sys.argv.
if [[ "${1:-}" == "--" ]]; then shift; fi

exec "$BLENDER" --background --factory-startup \
  --python-exit-code 1 \
  --python "$script" -- "$@"
