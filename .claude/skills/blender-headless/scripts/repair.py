"""Reparación de mallas importadas (p. ej. de un modelo generativo 3D).

Uso:
    run_headless.sh repair.py -- --in modelo.glb --out reparado.blend \
        [--target-x-m 0.020] [--merge-m 1e-6] [--remesh-voxel-m 0.0005]

Orden: importar, soldar, quitar degenerados, rellenar huecos, recalcular
normales, escalar. Después hay que volver a pasar census.py. Solo usa
bpy.ops para importar y guardar (no hay alternativa en bpy.data).
"""
import argparse
import os
import sys

import bmesh
import bpy


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="repair.py")
    p.add_argument("--in", dest="src", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--name", default="Part")
    p.add_argument("--merge-m", type=float, default=1e-6)
    p.add_argument("--target-x-m", type=float, help="escala uniforme para que X mida esto")
    p.add_argument("--holes-max-sides", type=int, default=0, help="0 = sin límite")
    p.add_argument("--remesh-voxel-m", type=float, help="aplica remesh por vóxeles con este tamaño")
    return p.parse_args(argv)


def import_any(path):
    ext = os.path.splitext(path)[1].lower()
    before = set(bpy.data.objects)
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".stl":
        bpy.ops.wm.stl_import(filepath=path)  # importador nuevo; el antiguo se retiró en 4.x
    elif ext == ".ply":
        bpy.ops.wm.ply_import(filepath=path)
    else:
        sys.exit(f"formato no soportado: {ext}")
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


def join_to_one(objs, name):
    """Une todas las mallas importadas en una, en espacio mundo, sin bpy.ops."""
    bm = bmesh.new()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_object(o, dg)
        tmp.transform(o.matrix_world)
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj, bm


def main():
    a = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = import_any(a.src)
    if not objs:
        sys.exit("no se importó ninguna malla")
    obj, bm = join_to_one(objs, a.name)

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=a.merge_m)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=a.merge_m)
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.holes_fill(bm, edges=bm.edges, sides=a.holes_max_sides)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    if a.target_x_m:
        xs = [v.co.x for v in bm.verts]
        span = max(xs) - min(xs)
        if span > 0:
            s = a.target_x_m / span
            bmesh.ops.scale(bm, vec=(s, s, s), verts=bm.verts)

    bm.to_mesh(obj.data)
    bm.free()

    if a.remesh_voxel_m:
        mod = obj.modifiers.new("Remesh", "REMESH")
        mod.mode = "VOXEL"
        mod.voxel_size = a.remesh_voxel_m
        dg = bpy.context.evaluated_depsgraph_get()
        new = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
        obj.modifiers.clear()
        old = obj.data
        obj.data = new
        bpy.data.meshes.remove(old)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.out))
    print(f"REPAIR OK -> {a.out}")


main()
