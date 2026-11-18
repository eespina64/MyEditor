Prompt de corrección. Después de aplicar el diff, repite el censo.

```text
Change constants in the parameter block only. Do not restructure, do not
rename, do not add geometry.

Apply exactly: <discrepancy list>
Return a diff.
```

Si una discrepancia no se puede resolver cambiando constantes, no la fuerces aquí: vuelve al prompt de generación con la especificación corregida.
