"""Censo de malla dentro de Blender: preguntas que un render no responde.

Uso (headless):
    run_headless.sh census.py -- --params params.json [--blend part.blend] [--json out.json]

Mide la malla EVALUADA (con modificadores), así que un Solidify o un
Boolean que no se ve en el viewport sí cuenta. Sale con código 1 si
cualquier comprobación falla.

Convención: 1 unidad de Blender = 1 metro.
"""
import argparse
import json
import math
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="census.py")
    p.add_argument("--params", required=True, help="params.json con dims_m, tolerancias, etc.")
    p.add_argument("--blend", help="archivo .blend que contiene la pieza")
    p.add_argument("--json", help="escribe el resultado del censo en este archivo")
    return p.parse_args(argv)


def evaluated_bmesh(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    bm.from_object(obj, dg)          # aplica modificadores sin bpy.ops
    bm.transform(obj.matrix_world)   # medidas en espacio mundo
    bm.normal_update()
    return bm


def count_shells(bm):
    seen, shells = set(), 0
    for f in bm.faces:
        if f.index in seen:
            continue
        shells += 1
        stack = [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
    return shells


def thin_wall_faces(bm, tree, min_wall):
    """Lanza un rayo hacia dentro desde cada cara; un impacto más cerca que
    min_wall indica pared delgada. Es una aproximación: no sustituye al
    análisis de espesor del 3D-Print Toolbox."""
    thin = 0
    eps = min_wall * 1e-3
    for f in bm.faces:
        n = f.normal
        if n.length < 0.5:
            continue
        origin = f.calc_center_median() - n * eps
        hit, _normal, idx, dist = tree.ray_cast(origin, -n, min_wall)
        if hit is not None and idx != f.index and dist is not None and dist < min_wall:
            thin += 1
    return thin


def census(obj, params):
    bm = evaluated_bmesh(obj)
    bm.faces.ensure_lookup_table()
    deg_area = params.get("degenerate_area_m2", 1e-12)
    zero_len = math.sqrt(deg_area)

    r = {}
    r["non_manifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold)
    r["inconsistent_normals"] = sum(1 for e in bm.edges if e.is_manifold and not e.is_contiguous)
    r["loose_verts"] = sum(1 for v in bm.verts if not v.link_faces)
    r["loose_edges"] = sum(1 for e in bm.edges if not e.link_faces)
    r["zero_length_edges"] = sum(1 for e in bm.edges if e.calc_length() <= zero_len)
    r["degenerate_faces"] = sum(1 for f in bm.faces if f.calc_area() <= deg_area)
    r["non_finite_verts"] = sum(1 for v in bm.verts if not all(math.isfinite(c) for c in v.co))

    tree = BVHTree.FromBMesh(bm, epsilon=1e-9)
    # Con el mismo árbol, overlap() excluye pares de caras que comparten vértices.
    r["self_intersections"] = len(tree.overlap(tree))

    r["shells"] = count_shells(bm)
    vol = bm.calc_volume(signed=True)
    r["signed_volume_m3"] = vol

    if "min_wall_m" in params:
        r["thin_wall_faces"] = thin_wall_faces(bm, tree, params["min_wall_m"])

    r["dimensions_m"] = list(obj.dimensions)
    r["object_scale"] = list(obj.scale)
    bm.free()
    return r


def verdict(r, params):
    fails = []
    for key in ("non_manifold_edges", "inconsistent_normals", "loose_verts", "loose_edges",
                "zero_length_edges", "degenerate_faces", "non_finite_verts",
                "self_intersections", "thin_wall_faces"):
        if r.get(key, 0) != 0:
            fails.append(f"{key} = {r[key]} (esperado 0)")
    if r["signed_volume_m3"] <= 0:
        fails.append(f"volumen con signo {r['signed_volume_m3']:.3e} <= 0: normales hacia dentro o malla abierta")
    exp_shells = params.get("expect_shells")
    if exp_shells is not None and r["shells"] != exp_shells:
        fails.append(f"shells = {r['shells']} (esperado {exp_shells}): piezas sueltas o vacíos internos")
    if any(abs(s - 1.0) > 1e-9 for s in r["object_scale"]):
        fails.append(f"escala de objeto sin aplicar {r['object_scale']}: el exportador puede ignorarla")
    if "dims_m" in params:
        tol = params.get("dims_tol_m", 1e-5)
        for axis, got, want in zip("xyz", r["dimensions_m"], params["dims_m"]):
            if abs(got - want) > tol:
                fails.append(f"dimensión {axis} = {got:.6f} m, esperado {want:.6f} ± {tol} m")
    return fails


def main():
    args = parse_args()
    with open(args.params, encoding="utf-8") as fh:
        params = json.load(fh)
    if args.blend:
        bpy.ops.wm.open_mainfile(filepath=args.blend)  # wm, no malla: funciona sin UI

    name = params.get("object", "Part")
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "MESH":
        print(f"CENSUS FAIL: no hay un objeto de malla llamado {name!r}", file=sys.stderr)
        sys.exit(1)

    r = census(obj, params)
    fails = verdict(r, params)
    r["fails"] = fails
    print(json.dumps(r, indent=2, ensure_ascii=False))
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(r, fh, indent=2, ensure_ascii=False)
    if fails:
        print("CENSUS FAIL:\n  - " + "\n  - ".join(fails), file=sys.stderr)
        sys.exit(1)
    print("CENSUS OK")


main()
