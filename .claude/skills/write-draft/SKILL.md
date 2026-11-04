---
name: write-draft
description: Redacta un artículo a partir de sources/ y verifica sus afirmaciones con el evidence-reviewer. Úsalo cuando el usuario pida preparar un artículo, borrador o texto basado en fuentes.
---
Tema solicitado: $ARGUMENTS

1. Lee `sources/task.md` para conocer lector, entregable, criterios de aceptación y restricciones. Lee los archivos relevantes de `sources/` y abre sus enlaces a fuentes primarias. Resultado: lista de fuentes seleccionadas.
2. Escribe un esquema y luego guarda el borrador en `drafts/article.md`. Resultado: archivo guardado.
3. Pide al subagente `evidence-reviewer` que compruebe las afirmaciones del borrador. Pásale la ruta del borrador, las rutas de las fuentes y la lista de afirmaciones a revisar. Resultado: tabla de hallazgos.
4. Corrige las afirmaciones `incorrect` con la corrección indicada y vuelve a revisar las oraciones vecinas si cambia el sentido del párrafo. Marca cada afirmación `unresolved` en el borrador con `[SIN VERIFICAR: evidencia que falta]`.
5. Guarda la tabla final en `drafts/checks.md` con las columnas: afirmación, veredicto, URL de la fuente, fecha de comprobación, corrección aplicada. La tabla debe describir el borrador corregido, no el original.
6. Actualiza `progress.md` con decisiones, problemas abiertos y la siguiente acción.
7. Devuelve las dos rutas de salida y el recuento de veredictos (verified / incorrect corregidas / unresolved).

No copies nada a `published/`. Publicar requiere su propia acción y autorización.
Distingue siempre la fecha de un anuncio de la fecha en que una función quedó disponible.
