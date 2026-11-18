---
name: blender-headless
description: Genera, valida y corrige piezas 3D con Blender Python en modo headless (sin UI). Fija la versión de Blender, prohíbe bpy.ops de malla, mide la geometría con un censo de asserts antes de mirar un render y corrige solo constantes. Úsalo cuando el usuario pida un script de Blender, una pieza para imprimir en 3D, validar una malla (STL/OBJ/glTF) o revisar geometría generada por un modelo.
---
Pieza o tarea solicitada: $ARGUMENTS

Antes de empezar, lee `references/notas-api.md`. Los datos que dependen de la versión están marcados `[SIN VERIFICAR]` hasta comprobarlos en docs.blender.org.

## 1. Fijar la versión

1. Pregunta o confirma la versión de destino (por defecto la LTS vigente). Resultado: versión y versión de Python anotadas.
2. Ejecuta `scripts/run_headless.sh --check-version <versión>` para comprobar que el binario instalado coincide. Si no coincide, detente.

## 2. Generar

1. Usa `prompts/system.md` como bloque de sistema y `prompts/generate.md` con la especificación de la pieza.
2. El script generado debe declarar `MM = 0.001`, tener todas las medidas como constantes de módulo y escribir `params.json` (ver formato abajo).
3. Guarda el script en `drafts/blender/<pieza>/build.py`. Resultado: script y tabla de parámetros.

## 3. Ejecutar y medir

1. Ejecuta `scripts/run_headless.sh drafts/blender/<pieza>/build.py -- --out drafts/blender/<pieza>/dist`.
2. Ejecuta el censo: `scripts/run_headless.sh scripts/census.py -- --params drafts/blender/<pieza>/params.json --blend drafts/blender/<pieza>/dist/part.blend`.
3. Si exportas STL/OBJ/GLB y hay `trimesh`, ejecuta también `python3 scripts/census_trimesh.py <archivo> --params <params.json>`.
4. Si el censo falla en una malla importada, aplica `scripts/repair.py` y repite el censo. No reparar geometría propia: corrige el generador.

## 4. Mirar, solo después de medir

1. Con el censo en verde, genera la hoja de vistas: `scripts/run_headless.sh scripts/contact_sheet.py -- --blend <part.blend> --out <dist>/sheet.png`.
2. Revisa la imagen con `prompts/critique.md` y la tabla de parámetros. Resultado: lista de discrepancias.
3. Aplica `prompts/patch.md`: solo se cambian constantes. Vuelve al paso 3.

## Formato de `params.json`

```json
{
  "object": "Part",
  "dims_m": [0.020, 0.020, 0.010],
  "dims_tol_m": 1e-5,
  "min_wall_m": 0.0012,
  "expect_shells": 1,
  "degenerate_area_m2": 1e-12
}
```

## Reglas fijas

- El código de ejecución en Blender vive en `drafts/`, nunca en `src/` ni en `published/`.
- Ejecuta siempre con `--python-exit-code 1`; un traceback sin él deja el código de salida en 0.
- Los servidores MCP de Blender (oficial o comunitario) ejecutan código sin protección: úsalos solo en una máquina de desarrollo o una VM, nunca con este repositorio montado.
- Guarda en `progress.md` la versión fijada, el resultado del censo y la siguiente acción.
- Al terminar, devuelve las rutas de salida y la tabla del censo.
