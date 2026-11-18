Prompt de generación. Rellena la especificación con números en milímetros.

```text
Build the part described below as a single Python file.

<spec: outer dimensions, wall, clearances, holes, tolerance, export path>

Output the parameter block first as a table. I will assert against it.
```

Parámetros de impresión por defecto (los cuatro valores en los que coinciden las guías habituales). Pásalos como constantes con nombre; cualquier otro valor discutido va como argumento con valor por defecto, no fijo en el código:

| Constante | Valor |
|---|---|
| `MAX_OVERHANG_DEG` | 45 |
| `MIN_HOLE_D` | 2.0 * MM |
| `ASSEMBLY_CLEARANCE` | 0.5 * MM |
| `MIN_WALL` | 1.2 * MM (rango habitual 1.0–1.2) |
