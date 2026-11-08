"""Read the sprint car's hardpoints straight out of the SolidWorks STL export
and write kinematics/hp.json.

Every pivot in this car is a rod end, and SolidWorks exports the BALL of each one
as its own part, so the pivot is the centre of a 1 in sphere - an exact fit, not a
centroid guess. The steering joints use a smaller heim with no separate ball part,
so those fall back to the housing centroid. Kingpin axes come from the spindle: drop
the faces that belong to the stub axle, and what is left is the kingpin bore.

Frame: x forward, y left, z up, inches. Origin mid-wheelbase, centreline, ground.

usage: python hardpoints.py ["C:\\...\\Sprint Car"]
needs: pip install trimesh
"""
import glob, json, os, sys
import numpy as np, trimesh

D = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Jared\Documents\Prototypes\Sprint Car"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "launcher", "web", "hp.json")

M = {}
for f in sorted(glob.glob(os.path.join(D, "*.STL"))):
    M[os.path.basename(f).split(" - ", 1)[-1][:-4]] = trimesh.load(f)
if "Front Axle Sprint Car-1" not in M:
    sys.exit(f"{D!r} does not look like the sprint car export")

# ---- frame: mid-wheelbase, centreline, lowest tyre contact ----
TY = ["Front Tire-1", "Front Tire-2", "LR Tire-1", "RR Tire 1-1"]
wc = np.array([M[n].vertices.mean(axis=0) for n in TY])
XM = (wc[:2, 0].mean() + wc[2:, 0].mean()) / 2
YM = wc[:, 1].mean()
ZG = min(M[n].vertices[:, 2].min() for n in TY)

def veh(p):
    p = np.atleast_2d(np.asarray(p, float))
    return np.c_[-(p[:, 0] - XM), -(p[:, 1] - YM), p[:, 2] - ZG]

def vdir(d):
    d = np.asarray(d, float)
    return np.array([-d[0], -d[1], d[2]])

r3 = lambda p: [round(float(v), 3) for v in np.ravel(p)]

# ---- pivots ----
def ball(n):
    """exact centre of a rod-end ball: algebraic sphere fit, worst 40% dropped (the stud)"""
    v = M["Ball Joint Ball " + n].vertices
    for _ in range(5):
        A = np.c_[2 * v, np.ones(len(v))]
        x = np.linalg.lstsq(A, (v ** 2).sum(axis=1), rcond=None)[0]
        c = x[:3]; rad = np.sqrt(x[3] + (c ** 2).sum())
        d = np.abs(np.linalg.norm(v - c, axis=1) - rad)
        v = v[d <= np.quantile(d, 0.6)]
    return veh(c)[0]

heim = lambda n: veh(M["Ball Joint " + n].vertices.mean(axis=0))[0]

def ends(n, trim=1.2):
    """the two ends of a link, as the mean of the vertices within `trim` of each extreme"""
    v = veh(M[n].vertices)
    c = v.mean(axis=0)
    ax = np.linalg.svd(v - c, full_matrices=False)[2][0]
    t = (v - c) @ ax
    return v[t < t.min() + trim].mean(axis=0), v[t > t.max() - trim].mean(axis=0)

def spin(n, s):
    """Wheel spin axis, pointing outboard (s = +1 left, -1 right).

    A wheel is a flat disc, so its axis is the direction of least spread - but weight
    the faces by area, not the vertices. The rear tyres are far more finely meshed on
    the tread than on the sidewall, and a plain vertex fit picks the wrong axis.
    """
    m = M[n]
    c = m.triangles_center
    c = c - np.average(c, axis=0, weights=m.area_faces)
    C = (c * m.area_faces[:, None]).T @ c
    a = vdir(np.linalg.eigh(C)[1][:, 0])
    return -a if a[1] * s < 0 else a

def kingpin(sp, tyre, s):
    """Kingpin axis from the spindle: a cylinder's normals are all perpendicular to its
    axis, so the axis is the least-represented direction among the face normals. Drop
    the stub axle's skin first (its normals are perpendicular to the wheel axis) and
    the kingpin bore is what is left."""
    m, a = M[sp], vdir(spin(tyre, s))
    n, w = m.face_normals, m.area_faces
    keep = np.abs(n @ a) > 0.25
    C = (n[keep] * w[keep, None]).T @ n[keep]
    k = vdir(np.linalg.eigh(C)[1][:, 0])
    if k[2] < 0:
        k = -k
    perp = np.abs(m.face_normals @ vdir(k)) < 0.2
    return k, veh(m.triangles_center[perp].mean(axis=0))[0]

ang = lambda x, y: float(np.degrees(np.arctan2(x, y)))

hp = {
    "note": ("Sprint car hardpoints, inches, vehicle frame: x forward, y left, z up. "
             "Origin mid-wheelbase, car centreline, ground (the lowest tyre contact as "
             "modelled). Written by tools/hardpoints.py from the SolidWorks STL export."),
    "dims": {"wheelbase": round(float(wc[2:, 0].mean() - wc[:2, 0].mean()), 2),
             "frontTrack": round(float(abs(wc[0, 1] - wc[1, 1])), 2),
             "rearTrack": round(float(abs(wc[2, 1] - wc[3, 1])), 2)},
    "front": {}, "rear": {},
}

# front: three radius rods (the left upper position is empty on this car) + a track bar
hp["front"]["rods"] = [
    {"name": "RU", "side": "R", "chassis": r3(ball("1-2")), "axle": r3(ball("1-6"))},
    {"name": "RL", "side": "R", "chassis": r3(ball("1-1")), "axle": r3(ball("1-5"))},
    {"name": "LL", "side": "L", "chassis": r3(ball("1-3")), "axle": r3(ball("1-4"))},
]
hp["front"]["trackBar"] = {"axle": r3(ball("1-7")), "chassis": r3(ball("1-8"))}
hp["front"]["shock"] = {"L": {"chassis": r3(ball("1-12")), "axle": r3(ball("1-11"))},
                        "R": {"chassis": r3(ball("1-10")), "axle": r3(ball("1-9"))}}
hp["front"]["steer"] = {
    "box": r3(ends("Pitman Arm-1")[1]), "pitman": r3(heim("3-19")),
    "dragOuter": r3(heim("3-21")), "tieL": r3(heim("3-18")), "tieR": r3(heim("3-20")),
}
# torsion arms: pivot on the bar axis at the arm's own y, free end at the arm's tip
fb = {}
for side, arm, bar in (("L", "Front Bar Arm-1", "Torsion Bar-1"), ("R", "Front Bar Arm-2", "Torsion Bar-2")):
    tip, root = ends(arm)
    bv = veh(M[bar].vertices)
    fb[side] = {"pivot": r3([bv[:, 0].mean(), tip[1], bv[:, 2].mean()]), "arm": r3(tip)}
hp["front"]["bar"] = fb

hp["rear"]["rods"] = [
    {"name": "LT", "side": "L", "chassis": r3(ball("1-17")), "axle": r3(ball("1-18"))},
    {"name": "RT", "side": "R", "chassis": r3(ball("1-16")), "axle": r3(ball("1-19"))},
]
up, lo = ends("Jacob Ladder Strap-1"), ends("Jacob Ladder Strap-2")
# each strap runs from the ladder (on the axle, nearer the centreline) out to the chassis bracket
pick = lambda e: (e[0], e[1]) if abs(e[0][1]) < abs(e[1][1]) else (e[1], e[0])
aU, cU = pick(up)
aL, cL = pick(lo)
# the straps pick up a triangle that is pinned to the right-rear birdcage; that pin is
# what lets the axle heave without the straps changing length, so it is a hardpoint
hp["rear"]["ladder"] = {"chassisUp": r3(cU), "chassisLo": r3(cL),
                        "axleUp": r3(aU), "axleLo": r3(aL), "pin": r3(ball("1-13"))}
rb = {}
for side, arm, bar, bj in (("L", "LR Bar End-1", "Torsion Bar-4", "1-15"),
                           ("R", "RR Bar End-1", "Torsion Bar-3", "1-14")):
    tip, root = ends(arm)
    if abs(tip[0]) > abs(root[0]):
        tip, root = root, tip        # the tip is the inboard (birdcage) end
    bv = veh(M[bar].vertices)
    rb[side] = {"pivot": r3([bv[:, 0].mean(), root[1], bv[:, 2].mean()]), "arm": r3(ball(bj))}
hp["rear"]["bar"] = rb
hp["rear"]["shock"] = {"L": {"chassis": r3(heim("3-13")), "arm": r3(heim("3-17"))},
                       "R": {"chassis": r3(heim("3-14")), "arm": r3(heim("3-15"))}}

def tube_axis(n):
    """Centreline of a long part, area weighted so a fine-meshed end cannot pull it over."""
    m = M[n]
    c = m.triangles_center
    o = np.average(c, axis=0, weights=m.area_faces)
    d = (c - o) * m.area_faces[:, None]
    return veh(o)[0], vdir(np.linalg.eigh((c - o).T @ d)[1][:, -1])


def nearest_on(p0, d0, p1, d1):
    """Point on line 0 closest to line 1 - where the kingpin crosses the axle tube."""
    d0, d1 = d0 / np.linalg.norm(d0), d1 / np.linalg.norm(d1)
    w, b = p0 - p1, float(d0 @ d1)
    den = 1 - b * b
    if abs(den) < 1e-9:
        return p0
    return p0 + d0 * ((b * (d1 @ w) - (d0 @ w)) / den)


AX_P, AX_D = tube_axis("Front Axle Sprint Car-1")
hp["front"]["axle"] = {"p": r3(AX_P), "dir": [round(float(v), 4) for v in AX_D]}

kpv = {}
for side, sp, ty, s in (("L", "Spindle-1", "Front Tire-1", 1), ("R", "Spindle-2", "Front Tire-2", -1)):
    k, p = kingpin(sp, ty, s)
    # the bend point: where the kingpin line crosses the axle tube centreline. Camber and
    # caster turn the end of the axle about this, which is what keeps the spindle in place.
    bend = nearest_on(np.asarray(p, float), k, AX_P, AX_D)
    kpv[side] = {"p": r3(p), "dir": [round(float(v), 4) for v in k], "bend": r3(bend)}
    a = spin(ty, s)
    print(f"{side}F  caster {ang(-k[0], k[2]):6.2f}  KPI {ang(-s*k[1], k[2]):6.2f}   "
          f"camber {ang(-a[2], 1):6.2f}   toe-out {ang(-a[0], s*a[1]):6.3f}   "
          f"bend at {bend[0]:6.2f}{bend[1]:7.2f}{bend[2]:6.2f}")
hp["front"]["kingpin"] = kpv

wh = {}
for end, (nl, nr) in (("front", ("Front Tire-1", "Front Tire-2")), ("rear", ("LR Tire-1", "RR Tire 1-1"))):
    for side, n, s in (("L", nl, 1), ("R", nr, -1)):
        v = M[n].vertices
        c = veh(v.mean(axis=0))[0]
        a = spin(n, s)
        # radius about the spin axis, not the lowest vertex: the car is not level as modelled
        d = v - v.mean(axis=0)
        rad = np.linalg.norm(d - np.outer(d @ vdir(a), vdir(a)), axis=1).max()
        wh.setdefault(end, {})[side] = {"c": r3(c), "r": round(float(rad), 2),
                                        "axis": [round(float(q), 4) for q in a]}
    hp[end]["wheel"] = wh[end]

# ---- ride height points: the lowest part of the chassis at each corner ----
# the rails are one tube, so there is one low spot per corner; average the few vertices on
# it (the mesh faces share it) rather than trust a single one
cv = veh(M["Chassis-1"].vertices)
def lowest(sx, sy):
    q = cv[(cv[:, 0] * sx > 0) & (cv[:, 1] * sy > 0)]
    return r3(q[q[:, 2] < q[:, 2].min() + 0.02].mean(axis=0))
hp["chassis"] = {"ride": {"LF": lowest(1, 1), "RF": lowest(1, -1), "LR": lowest(-1, 1), "RR": lowest(-1, -1)}}

json.dump(hp, open(OUT, "w"), indent=1)
print(f"\nwrote {os.path.normpath(OUT)}")
print(f"wheelbase {hp['dims']['wheelbase']}  front track {hp['dims']['frontTrack']}  "
      f"rear track {hp['dims']['rearTrack']}")
print("\nride height as modelled - contact patch above the z=0 datum, in:")
for end in ("front", "rear"):
    for side in ("L", "R"):
        w = hp[end]["wheel"][side]
        print(f"  {side}{end[0].upper()}  {w['c'][2] - w['r']:+6.2f}   (wheel centre z {w['c'][2]:.2f}, radius {w['r']:.2f})")
print("A row far from 0.00 means the CAD is not sitting flat on the ground - set the\n"
      "ride heights in the app, or re-export with the car settled.")
