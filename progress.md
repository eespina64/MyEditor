Tarea: ninguna activa
Salidas: drafts/article.md, drafts/checks.md (aún no creadas)
Completado: entorno de trabajo configurado (CLAUDE.md, skill write-draft, subagente evidence-reviewer, permisos en .claude/settings.json)
Decisiones: los borradores se escriben en español; published/ está protegido contra ediciones de Claude
Problemas abiertos: ninguno
Siguiente acción: rellenar sources/task.md, añadir las fuentes a sources/ y ejecutar el /goal de docs/FLUJO-AGENTE.md

## 2026-11-18 · Skill blender-headless

Completado: skill `.claude/skills/blender-headless/` con versión fijada, ejecución headless, censo de malla (Blender y trimesh), reparación, hoja de seis vistas y los prompts SYSTEM/GENERATE/CRITIQUE/PATCH.
Verificación: `census_trimesh.py` probado con caja válida, malla abierta, escala en mm y dos cuerpos; los scripts de Blender solo compilan, porque Blender no está instalado aquí.
Decisión: umbral de cara degenerada 1e-12 m² en lugar del 1e-4 del artículo, que equivale a 1 cm².
Problemas abiertos: los datos de versión de `references/notas-api.md` siguen `[SIN VERIFICAR]`, porque blender.org y docs.blender.org están bloqueados por la red de la sesión.
Siguiente acción: permitir docs.blender.org, verificar las notas y ejecutar `census.py` y `contact_sheet.py` en un Blender 5.2 real.
