# Notas de API de Blender para scripts headless

Origen: artículo «Opus 5.5 Writes Blender Python for the Wrong Blender» (11 oct. 2026), aportado por el usuario el 2026-11-18.
Los datos marcados `[SIN VERIFICAR]` no se han contrastado con una fuente primaria: docs.blender.org y blender.org estaban bloqueados por la red de la sesión.
Cuando se verifique un dato, quita la marca y añade la URL y la fecha de comprobación.

## Versiones

- Versión actual: 5.2.2 LTS; la otra línea mantenida es 4.5 LTS. `[SIN VERIFICAR]` Fuente a consultar: https://www.blender.org/download/lts/
- Python pasó de 3.11 a 3.13 en Blender 5.1. `[SIN VERIFICAR]`
- La rueda `bpy` de PyPI está compilada para una única versión de Python; no hay compatibilidad aproximada. `[SIN VERIFICAR]`

## Línea de comandos

- Sin `--python-exit-code 1`, un traceback del script no cambia el código de salida de Blender y la CI pasa en verde.
- El orden de los argumentos importa: `-o` va después del archivo `.blend`, porque cargarlo restablece la ruta de salida.
- Todo lo que va después de `--` llega al script en `sys.argv`.
- Fuente a consultar: https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html

## Operadores frente a datos

- Los operadores (`bpy.ops`) dependen del contexto de la UI y solo devuelven si terminaron; un `poll` fallido lanza `RuntimeError: ... context is incorrect` sin dar el motivo.
- En `--background` no hay contexto de edición de malla, así que `bpy.ops.mesh.*` falla.
- Para aplicar modificadores sin operadores: `obj.evaluated_get(depsgraph)` y `bpy.data.meshes.new_from_object(...)` o `bmesh.from_object(obj, depsgraph)`.
- Fuente a consultar: https://docs.blender.org/api/current/info_gotchas_operators.html

## Booleanos

- Solver `FLOAT`: documentado sin soporte para geometría solapada. `[SIN VERIFICAR]`
- Solver `MANIFOLD`: solo funciona con mallas manifold. `[SIN VERIFICAR]`
- Solver `EXACT`: el que tolera entradas sucias; usarlo por defecto con geometría generada.
- El solver por defecto del modificador puede no ser `EXACT` según la versión: fíjalo siempre de forma explícita.

## Identificadores que cambiaron

- Motor EEVEE: `BLENDER_EEVEE` → `BLENDER_EEVEE_NEXT` (4.2) → `BLENDER_EEVEE` (5.0). `[SIN VERIFICAR]`
- Compositor, booleanos y secuenciador son las áreas con más cambios en 5.0. `[SIN VERIFICAR]`
- Para vistas rápidas, `BLENDER_WORKBENCH` es el identificador más estable.
- Cycles no dibuja en una vista offscreen de GPU; usa EEVEE o Workbench.
- Blender 5.2 añadió `gpu.init()` para obtener un backend de GPU en `--background`. `[SIN VERIFICAR]`

## Unidades y escala

- `primitive_cube_add()` crea un cubo de 2 unidades; `size=` es la arista completa.
- `unit_settings.scale_length` solo afecta a la visualización; geometría, física y exportación lo ignoran.
- STL y OBJ no guardan unidades: hay que pasar `use_scene_unit` o `global_scale` al exportar.
- glTF exige metros y Y arriba por especificación, y el exportador no tiene opción de escala: 1 unidad sale como 1 metro.
- Convención del proyecto: `MM = 0.001`; una pieza de 20 mm mide `0.02`.

## Censo de malla

- El umbral de cara degenerada `calc_area() <= 1e-4` del artículo equivale a 1 cm² con 1 unidad = 1 m.
  Marcaría como degeneradas casi todas las caras de una pieza de 20 mm; `census.py` usa 1e-12 m² por defecto y lo deja configurable.
- `BVHTree.overlap()` con el mismo árbol excluye pares de caras que comparten vértices, así que cuenta autointersecciones reales.
- En trimesh, `is_volume` (estanca, bobinado consistente, normales hacia fuera) es la prueba de sólido; `is_watertight` es más débil.
- 3D-Print Toolbox ya no viene incluido en Blender: es una extensión comunitaria y una tubería headless tiene que instalarla. `[SIN VERIFICAR]`
  Sus valores por defecto (1 mm de espesor mínimo, 45° de voladizo) solo son correctos si 1 unidad = 1 metro.

## Mallas de modelos generativos

- Ningún modelo generativo 3D alojado importante garantiza mallas estancas; TRELLIS.2 anuncia geometría no manifold como característica. `[SIN VERIFICAR]`
- Orden de reparación: validar, censo, `bmesh.ops` (`remove_doubles`, `dissolve_degenerate`, `holes_fill`, `recalc_face_normals`), escala y orientación, booleanos, y por último remesh si hace falta topología limpia.

## Servidores MCP de Blender

- Servidor oficial de Blender Lab (complemento v1.0.3, Blender 5.1+): su página advierte que ejecuta código generado sin protección y recomienda una VM. `[SIN VERIFICAR]`
- Servidor comunitario: TCP sin autenticación ni cifrado en `localhost:9876`; tuvo un CVE de path traversal corregido en 1.6.5. `[SIN VERIFICAR]`
- Regla del proyecto: solo en una máquina de desarrollo o una VM.
