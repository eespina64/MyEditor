# Flujo de trabajo con Claude Code

Cada tarea deja un resultado que puedes abrir, evidencia que puedes inspeccionar y progreso guardado para continuar otro día.

## Dónde vive cada pieza

| Capa | Archivo | Qué hace |
|------|---------|----------|
| 1. Datos del proyecto | `CLAUDE.md` | Reglas que valen para todas las tareas. Se relee tras la compactación. |
| 2. Procedimiento | `.claude/skills/write-draft/SKILL.md` | Pasos de redacción con un resultado observable cada uno. |
| 3. Fuentes externas | `claude mcp add ...` (opcional) | Solo si las fuentes están en un servicio externo. |
| 4. Reglas de acción | `.claude/settings.json` | Bloquea leer `.env*` y editar `published/`. |
| 5. Revisor | `.claude/agents/evidence-reviewer.md` | Verifica afirmaciones y devuelve una tabla con evidencia. |
| 6. Esfuerzo | comando de inicio + `effort: high` en el revisor | Sesión principal en `medium`, revisión en `high`. |
| 7. Objetivo | `/goal` | Define qué debe demostrar la ejecución para terminar. |

Las carpetas son `sources/` (referencias y `task.md`), `drafts/` (trabajo) y `published/` (aprobados, protegida).

## Antes de la primera ejecución

1. Crea la carpeta `published/` tú mismo; Claude tiene prohibido escribir ahí.
2. Rellena `sources/task.md` y añade las fuentes a `sources/`.
3. Si las fuentes están en Notion, conecta el servidor y comprueba una página conocida antes de depender de él:
   ```
   claude mcp add --transport http notion https://mcp.notion.com/mcp
   ```
   Autentica con `/mcp`. Desactiva desde `/mcp` los servidores que no se usen en esta tarea.
4. Inicia la sesión desde la raíz del proyecto:
   ```
   claude --model claude-opus-5-5 --effort medium
   ```
5. Revisa la configuración cargada: `/context` (instrucciones), `/agents` (debe aparecer `evidence-reviewer`) y `/permissions` (reglas de denegación).

Prueba inofensiva de permisos: crea a mano `published/prueba.md` y pide a Claude que lo edite. La edición debe ser denegada.
Esta regla solo cubre las herramientas de edición de Claude; un script de Python o Node puede saltársela, salvo que actives el sandbox del sistema operativo.

## Ejecutar una tarea

```
/goal Use write-draft to prepare an article from sources/. Completion requires drafts/article.md and drafts/checks.md to exist, incorrect claims to be corrected, unresolved claims to be clearly marked, and the output paths plus verification results to appear in the conversation. Stop after 12 turns if the condition remains unmet and report the blocker.
```

El límite de 12 turnos lo evalúa el modelo; para límites estrictos de tiempo o gasto hacen falta controles de ejecución. `/goal clear` elimina el objetivo activo.

Al terminar, abre `drafts/article.md` y `drafts/checks.md` y comprueba a mano varias parejas afirmación-fuente.
Confirma que `progress.md` coincide con lo que hay guardado.

## Continuar en una sesión nueva

```
Read progress.md and inspect the referenced draft and checks.
Continue from the recorded next action and update the progress note.
```

Si la sesión empieza de cero, falta información en `progress.md`: añade la decisión o la ruta que falte.

## Recuperación

`/rewind` restaura ediciones de archivos rastreadas. Los cambios hechos por shell y la mayoría de las ediciones de subagentes necesitan otra vía.
Haz commit después de cada etapa aceptada para conservar el historial.
Antes de repetir una escritura externa que agotó el tiempo, revisa el destino: el primer intento puede haberse completado.

## Medir

Usa `/usage` y `/context`, e incluye la revisión delegada y los reintentos en el total de la tarea.
Anota tu tiempo de revisión y las correcciones que necesitó el resultado.
Cambia un solo componente cada vez y repite la misma tarea con los mismos criterios de aceptación.

## Mejorar el procedimiento

Cuando una corrección se repita, añade el paso que falta a `write-draft`.
Una preferencia pasa a `CLAUDE.md` solo cuando confirmas que aplica a tareas futuras.
