"""Censo fuera de Blender con trimesh, sobre el archivo exportado.

Uso:
    python3 census_trimesh.py part.stl [--params params.json] [--units mm|m]

Comprueba lo que de verdad significa "es un sólido": is_volume
(estanca + bobinado consistente + normales hacia fuera + volumen finito).
is_watertight por sí solo es más débil. STL y OBJ no guardan unidades:
indica con --units en qué se exportó.
"""
import argparse
import json
import sys

try:
    import trimesh
except ImportError:
    sys.exit("error: falta trimesh (pip install trimesh)")

SCALE = {"m": 1.0, "mm": 0.001}


def count_bodies(mesh):
    """Componentes conexas por aristas compartidas, sin depender de scipy/networkx."""
    parent = list(range(len(mesh.faces)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b in mesh.face_adjacency:
        ra, rb = find(int(a)), find(int(b))
        if ra != rb:
            parent[ra] = rb
    return len({find(i) for i in range(len(parent))})


def main():
    p = argparse.ArgumentParser()
    p.add_argument("mesh")
    p.add_argument("--params")
    p.add_argument("--units", choices=SCALE, default="m",
                   help="unidades del archivo; glTF siempre es metros")
    a = p.parse_args()

    mesh = trimesh.load(a.mesh, force="mesh")
    k = SCALE[a.units]
    ext = [float(x) * k for x in mesh.extents]

    r = {
        "is_watertight": bool(mesh.is_watertight),
        "is_winding_consistent": bool(mesh.is_winding_consistent),
        "is_volume": bool(mesh.is_volume),
        "bodies": count_bodies(mesh),
        "extents_m": ext,
        # El volumen solo tiene sentido si is_volume es True.
        "volume_m3": float(mesh.volume) * k**3 if mesh.is_volume else None,
    }
    fails = []
    if not r["is_volume"]:
        fails.append("is_volume = False: no es un sólido imprimible")

    if a.params:
        with open(a.params, encoding="utf-8") as fh:
            params = json.load(fh)
        if "expect_shells" in params and r["bodies"] != params["expect_shells"]:
            fails.append(f"bodies = {r['bodies']}, esperado {params['expect_shells']}")
        if "dims_m" in params:
            tol = params.get("dims_tol_m", 1e-5)
            # extents está alineado con los ejes; se compara ordenado por si el
            # exportador rotó (p. ej. glTF a Y-arriba).
            for got, want in zip(sorted(ext), sorted(params["dims_m"])):
                if abs(got - want) > tol:
                    fails.append(f"extensión {got:.6f} m, esperado {want:.6f} ± {tol} m "
                                 "(¿error de escala ×1000 por unidades?)")

    r["fails"] = fails
    print(json.dumps(r, indent=2, ensure_ascii=False))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
