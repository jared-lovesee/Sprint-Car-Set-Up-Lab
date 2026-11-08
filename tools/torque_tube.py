"""Add the torque tube to the app: launcher/web/tube.glb and hp.json rear.torqueTube.

The tube came in a later export (2026-11-07) whose rear end is posed differently from the one
car.glb and hp.json were built from. So the tube is NOT taken in that export's coordinates.
What carries over is how it is attached:
  - the front half ends in the torque ball, held by the engine plate: a chassis point
    (the chassis itself only moved 0.143 in sideways between the two exports);
  - the rear half bolts to the rear end's nose: a point on the housing, kept as its distance
    along the axle, its radius from the axle and the tube's angle to that radius.
The app then pitches the housing about the axle until the bolted-on tube points at the ball
(SC.torqueTube in axle.js).

usage: python torque_tube.py ["C:\\...\\Sprint Car"]
"""
import json, os, sys
import numpy as np, trimesh
from make_model import OFF, crease_normals

D = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Jared\Documents\Prototypes\Sprint Car"
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "launcher", "web")
CHASSIS_SHIFT = np.array([0, 0.143, 0])     # new export minus old, measured on Chassis-1's bounding box

def load(name):
    m = trimesh.load(os.path.join(D, f"Sprint Car - {name}.STL")); m.merge_vertices()
    v = m.vertices - OFF; v[:, :2] *= -1      # same half turn as make_model.py
    return v, m.faces

def polar(p, C, a):
    """p against the axle: distance along it, radius from it, angle (deg) up from forward"""
    x = np.array([1.0, 0, 0]); f = x - (x @ a) * a; f /= np.linalg.norm(f); u = np.cross(f, a)
    d = p - C
    return d @ a, np.hypot(d @ f, d @ u), np.degrees(np.arctan2(d @ u, d @ f)), f, u

v1, f1 = load("Torque Tube-1-1")
v2, f2 = load("Torque Tube -2-1")
# ball: sphere fit to the front 3 in of the front half
ax = np.linalg.svd(v1 - v1.mean(0))[2][0]
ax = ax if ax[0] < 0 else -ax                  # pointing back, toward the rear end
t = (v1 - v1.mean(0)) @ ax; s = t < t.min() + 3
A = np.c_[2 * v1[s], np.ones(s.sum())]; q = np.linalg.lstsq(A, (v1[s] ** 2).sum(1), rcond=None)[0]
ball = q[:3]
t1 = (v1 - ball) @ ax
# nose: the flange face at the back of the rear half, which is where it bolts on
t2 = (v2 - ball) @ ax; nose = v2[t2 > t2.max() - 0.05].mean(0)
L1, L2 = t1.max(), t2.max() - t2.min()

# the housing in this export, from the rear tyres
tyre = lambda n: load(n)[0].mean(0)
cL, cR = tyre("LR Tire-1"), tyre("RR Tire 1-1")
Cn = (cL + cR) / 2; an = (cL - cR) / np.linalg.norm(cL - cR)
lat, r, phi, f, u = polar(nose, Cn, an)
d = ball - nose; tube = np.degrees(np.arctan2(d @ u, d @ f))

# the housing as car.glb has it drawn: its nose face, against hp.json's axle
hp = json.load(open(os.path.join(WEB, "hp.json")))
w = hp["rear"]["wheel"]
Co = (np.array(w["L"]["c"]) + np.array(w["R"]["c"])) / 2
ao = np.array(w["L"]["c"]) - np.array(w["R"]["c"]); ao /= np.linalg.norm(ao)
sc = trimesh.load(os.path.join(WEB, "car.glb"))
for nm in sc.graph.nodes_geometry:
    if "Winters" in nm:
        T, g = sc.graph[nm]; hv = trimesh.transform_points(sc.geometry[g].vertices, T)
noseOld = hv[hv[:, 0] > hv[:, 0].max() - 0.3].mean(0)
phiDrawn = polar(noseOld, Co, ao)[2]

hp["rear"]["torqueTube"] = {
    "note": "ball is chassis-fixed; nose is on the housing (noseLat along the axle, noseR from it); "
            "delta = tube angle minus nose angle about the axle, deg; phiDrawn = nose angle as car.glb draws it; "
            "mesh = the same two points in tube.glb's own frame; L1/L2 = each half, from ball / from nose",
    "ball": [round(x, 4) for x in ball - CHASSIS_SHIFT],
    "noseLat": round(lat, 4), "noseR": round(r, 4), "delta": round(tube - phi, 4), "phiDrawn": round(phiDrawn, 4),
    "L1": round(L1, 4), "L2": round(L2, 4),
    "mesh": {"ball": [round(x, 4) for x in ball], "nose": [round(x, 4) for x in nose]},
}
json.dump(hp, open(os.path.join(WEB, "hp.json"), "w"), indent=1)

out = trimesh.Scene()
for grp, (v, fc), nm in (("tt1", (v1, f1), "Torque Tube-1-1"), ("tt2", (v2, f2), "Torque Tube -2-1")):
    vv, ff, nn = crease_normals(v, fc)
    node = f"{grp}--steel--{nm}"
    out.add_geometry(trimesh.Trimesh(vv, ff, vertex_normals=nn, process=False), node_name=node, geom_name=node)
out.export(os.path.join(WEB, "tube.glb"), include_normals=True)
print("ball", ball.round(3), "nose", nose.round(3), f"halves {L1:.2f} / {L2:.2f}, overlap {L1 + L2 - np.linalg.norm(d):.2f}")
print(f"nose: {lat:.3f} along the axle, r {r:.3f}, at {phi:.2f} deg (drawn in car.glb {phiDrawn:.2f}); tube at {tube:.2f}")
