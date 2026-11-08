"""Add the top and front wings to the app: launcher/web/wing.glb.

They come from the 2026-11-08 "Sprint With Wings" export. That export is the torque tube export
moved 3.338 in rearward (every part, the chassis included), plus the two wings, so the wings are
put back by that and then by the same chassis shift torque_tube.py uses to reach car.glb's frame.
Both are sprung: the app moves them with the body, plus the Top/Front wing position sliders.

usage: python wings.py ["C:\\...\\Sprint With Wings"]
"""
import os, sys
import numpy as np, trimesh
from make_model import OFF, crease_normals

D = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Jared\Documents\Prototypes\Sprint Car\Sprint With Wings"
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "launcher", "web")
SHIFT = np.array([-3.338, 0, 0]) + np.array([0, 0.143, 0])   # this export minus car.glb's, measured on Chassis-1

out = trimesh.Scene()
for grp, nm in (("sprungWing", "Top Wing-1"), ("sprungFwing", "Front Wing-1")):
    m = trimesh.load(os.path.join(D, f"Sprint Car - {nm}.STL")); m.merge_vertices()
    v = m.vertices - OFF; v[:, :2] *= -1; v -= SHIFT          # same half turn as make_model.py
    vv, ff, nn = crease_normals(v, m.faces)
    node = f"{grp}--steel--{nm}"
    out.add_geometry(trimesh.Trimesh(vv, ff, vertex_normals=nn, process=False), node_name=node, geom_name=node)
    print(nm, "x", v[:, 0].min().round(2), "to", v[:, 0].max().round(2), "z", v[:, 2].min().round(2), "to", v[:, 2].max().round(2))
out.export(os.path.join(WEB, "wing.glb"), include_normals=True)
