"""Hoja de contacto: seis vistas con nombre en una sola imagen (3 x 2).

Uso:
    run_headless.sh contact_sheet.py -- --blend part.blend --out sheet.png [--px 512]

Es para la crítica visual, no para el veredicto: el censo va antes.
Usa Workbench (Cycles no sirve para vistas rápidas y es lento en CPU).
"""
import argparse
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector

VIEWS = [  # nombre, dirección desde el centro hacia la cámara, ortográfica
    ("front", Vector((0, -1, 0)), True),
    ("back", Vector((0, 1, 0)), True),
    ("left", Vector((-1, 0, 0)), True),
    ("right", Vector((1, 0, 0)), True),
    ("top", Vector((0, 0, 1)), True),
    ("three_quarter", Vector((1, -1, 0.8)).normalized(), False),
]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="contact_sheet.py")
    p.add_argument("--blend", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--px", type=int, default=512)
    return p.parse_args(argv)


def scene_bounds():
    pts = []
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    if not pts:
        sys.exit("no hay mallas visibles")
    lo = Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    return (lo + hi) / 2, (hi - lo).length


def render_view(scene, cam, center, size, direction, ortho, path):
    dist = size * 3
    cam.location = center + direction * dist
    if abs(direction.z) > 0.99:
        # Vista superior: una cámara sin rotar ya mira hacia -Z, con +Y arriba.
        cam.rotation_euler = (0, 0, 0)
    else:
        # -Z de la cámara apunta al centro; su Y local queda hacia el Z del mundo.
        cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "ORTHO" if ortho else "PERSP"
    cam.data.ortho_scale = size * 1.1
    cam.data.lens = 50
    cam.data.clip_start = size * 0.01
    cam.data.clip_end = dist + size * 2
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)  # el único operador que se usa aquí


def main():
    a = parse_args()
    bpy.ops.wm.open_mainfile(filepath=a.blend)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"  # identificador estable entre versiones
    scene.display.shading.light = "STUDIO"
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = scene.render.resolution_y = a.px
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"

    cam = bpy.data.objects.new("SheetCam", bpy.data.cameras.new("SheetCam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    center, size = scene_bounds()

    tmp = tempfile.mkdtemp(prefix="sheet_")
    tiles = []
    for name, d, ortho in VIEWS:
        path = os.path.join(tmp, f"{name}.png")
        render_view(scene, cam, center, size, d, ortho, path)
        tiles.append(bpy.data.images.load(path))

    cols, rows, px = 3, 2, a.px
    sheet = bpy.data.images.new("sheet", cols * px, rows * px, alpha=True)
    out = [0.0] * (cols * px * rows * px * 4)
    for i, img in enumerate(tiles):
        col, row = i % cols, rows - 1 - i // cols  # fila 0 de píxeles = abajo
        src = [0.0] * (px * px * 4)
        img.pixels.foreach_get(src)
        for y in range(px):
            s = y * px * 4
            d = ((row * px + y) * cols * px + col * px) * 4
            out[d:d + px * 4] = src[s:s + px * 4]
    sheet.pixels.foreach_set(out)
    sheet.filepath_raw = os.path.abspath(a.out)
    sheet.file_format = "PNG"
    sheet.save()
    print("SHEET OK -> " + a.out + "  orden: " + ", ".join(v[0] for v in VIEWS))


main()
