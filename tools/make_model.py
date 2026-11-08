"""Turn the SolidWorks STL export (one file per part, assembly coordinates, inches) into
launcher/web/car.glb for the app.

Two jobs:
  1. move everything into the vehicle frame - x forward, y left, z up, origin mid-wheelbase
     / centreline / ground - which is a half turn about z plus an offset;
  2. decide which moving group every part belongs to and what it is made of, and write both
     into the node name as "group--surface--part". Grouping is done HERE, by position
     against the hardpoints, not in the browser by part name: the part names in a
     SolidWorks export are not reliable (a link called "Suspension Link 2-3" tells you
     nothing about which corner it is on), while the hardpoints are exact. The app splits
     the node name on "--" (a colon does not survive the glTF export).
  3. bake per-vertex normals with a crease angle, so machined parts stop looking like soap.

usage: python make_model.py ["C:\\...\\Sprint Car"]
needs: pip install trimesh fast_simplification
"""
import glob, json, os, re, sys
import numpy as np, trimesh, fast_simplification as fs

D = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Jared\Documents\Prototypes\Sprint Car"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "launcher", "web", "car.glb")
hp = json.load(open(os.path.join(HERE, "..", "launcher", "web", "hp.json")))

# must match tools/hardpoints.py
OFF = np.array([61.970, 35.602, 2.727])

# a shock is ~45 parts, nearly all sealed inside the body: keep only what shows
SHOCK = re.compile(r"(7in|9in) (Body|Shaft)-\d", re.I)
SHOCK_VISIBLE = re.compile(r"CYLINDER|CLOSURE CAP|PISTON END HOUSING|Body-7"
                           r"|ROD END HOUSING-|SPHERICAL BEARING|SHAFT-\d+$", re.I)
# the balls live inside the rod ends and the bolts inside the bar stops: nothing to see
DROP = re.compile(r"Ball Joint Ball|Bar Stop Bolt", re.I)

# ---- which group each hardpoint belongs to, so rod ends can be placed by position ----
F, R = hp["front"], hp["rear"]
anchors = []                               # (point, group)
for i, rod in enumerate(F["rods"]):
    g = "frod" + rod["name"]
    anchors += [(rod["chassis"], g), (rod["axle"], g)]
anchors += [(F["trackBar"]["axle"], "ftb"), (F["trackBar"]["chassis"], "ftb")]
for s in "LR":
    anchors += [(F["shock"][s]["chassis"], "fshk" + s + "b"), (F["shock"][s]["axle"], "fshk" + s + "r")]
    anchors += [(F["bar"][s]["pivot"], "sprung"), (F["bar"][s]["arm"], "fbar" + s)]
    anchors += [(R["bar"][s]["pivot"], "sprung"), (R["bar"][s]["arm"], "rbar" + s)]
    anchors += [(R["shock"][s]["chassis"], "rshk" + s + "b"), (R["shock"][s]["arm"], "rshk" + s + "r")]
for i, rod in enumerate(R["rods"]):
    g = "rrod" + rod["side"]
    anchors += [(rod["chassis"], g), (rod["axle"], g)]
st = F["steer"]
anchors += [(st["pitman"], "drag"), (st["dragOuter"], "drag"),
            (st["tieL"], "tie"), (st["tieR"], "tie"), (st["box"], "sprung")]
anchors += [(R["ladder"]["chassisUp"], "sprung"), (R["ladder"]["axleUp"], "ladU"),
            (R["ladder"]["chassisLo"], "sprung"), (R["ladder"]["axleLo"], "ladL"),
            (R["ladder"]["pin"], "ladT")]
APTS = np.array([a[0] for a in anchors], float)
AGRP = [a[1] for a in anchors]

# ---- parts whose group is unambiguous from the name ----
BY_NAME = [
    (r"^Chassis", "sprung"),
    (r"^Torsion Bar|^Bar Stop", "sprung"),
    (r"^Pitman Arm Mount", "sprung"),
    (r"^Pitman Arm-", "pitman"),
    (r"^Front Axle", "faxle"),
    (r"^Winters", "raxle"),
    (r"^Jacob Ladder Body", "ladT"),      # the triangle swings on its pin, so it is its own group
    (r"^Jacob Ladder Strap-1", "ladU"),
    (r"^Jacob Ladder Strap-2", "ladL"),
    (r"^eft Side Bird Cage", "rcageL"),
    (r"^Right Side Bird Cage", "rcageR"),
    (r"^LR Bar End", "rbarL"),
    (r"^RR Bar End", "rbarR"),
    (r"^LR Tire", "rtyreL"),              # own groups: the LR grows and shrinks with stagger
    (r"^RR Tire", "rtyreR"),
    (r"^Torque Tube-1", "tt1"),           # front half, carries the torque ball
    (r"^Torque Tube -2", "tt2"),          # rear half, bolted to the rear end nose
]
# links and corner parts: pick the side/corner from where the part actually sits
def by_position(name, c):
    front, left = c[0] > 0, c[1] > 0
    if re.match(r"^Spindle|^LF Steering|^RF Steering|^Front Tire", name):
        return "fkn" + ("L" if left else "R")
    if re.match(r"^Front Bar Arm", name):
        return "fbar" + ("L" if left else "R")
    if re.match(r"^Suspension Link", name):
        # match both ends of the link to the nearest hardpoints and take the group they agree on
        v = PARTS[name]
        ax = np.linalg.svd(v - v.mean(axis=0), full_matrices=False)[2][0]
        t = (v - c) @ ax
        votes = {}
        for end in (v[t.argmin()], v[t.argmax()]):
            i = int(np.argmin(np.linalg.norm(APTS - end, axis=1)))
            votes[AGRP[i]] = votes.get(AGRP[i], 0) + 1
        return max(votes, key=votes.get)
    if SHOCK.search(name):
        # the "Body" half hangs off the chassis, the "Shaft" half off the axle
        g = ("fshk" if front else "rshk") + ("L" if left else "R")
        return g + ("b" if re.match(r"(7in|9in) Body", name) else "r")
    return None

# What a part is made of. Colour still comes from the group, so the sprung / link /
# unsprung legend keeps working - this only changes the surface, which is what makes a
# tyre stop looking like chrome.
SURFACE = [
    (r"Tire", "tyre"),
    (r"SHAFT-\d+$", "chrome"),
    (r"^Winters|CYLINDER|Body-7|CLOSURE CAP|PISTON END HOUSING|ROD END HOUSING", "alloy"),
]
CREASE = 35.0        # degrees; edges sharper than this stay sharp


def crease_normals(v, f, deg=CREASE):
    """Per-vertex normals that keep hard edges hard.

    An STL carries no smoothing groups, so welding the vertices and averaging every normal
    rounds off chamfers, plate edges and tube ends - that is what makes a machined part
    look like soap. Split the faces into groups that only ever meet at shallow angles,
    average within each group, and the sharp edges survive.
    """
    m = trimesh.Trimesh(v, f, process=False)
    smooth = m.face_adjacency[m.face_adjacency_angles < np.radians(deg)]
    comps = trimesh.graph.connected_components(
        smooth, nodes=np.arange(len(f)), min_len=1)
    fn, fa = m.face_normals, m.area_faces
    V, F, N, off = [], [], [], 0
    for comp in comps:
        comp = np.asarray(comp)
        uniq, inv = np.unique(f[comp], return_inverse=True)
        inv = inv.reshape(-1, 3)
        nn = np.zeros((len(uniq), 3))
        w = fn[comp] * fa[comp][:, None]
        for k in range(3):
            np.add.at(nn, inv[:, k], w)
        ln = np.linalg.norm(nn, axis=1)
        ln[ln == 0] = 1
        V.append(v[uniq]); N.append(nn / ln[:, None]); F.append(inv + off)
        off += len(uniq)
    return np.vstack(V), np.vstack(F), np.vstack(N)


PARTS = {}          # filled by main(); by_position() reads it


def main():
    for f in sorted(glob.glob(os.path.join(D, "*.STL"))):
        n = os.path.basename(f).split(" - ", 1)[-1][:-4]
        if DROP.search(n) or (SHOCK.search(n) and not SHOCK_VISIBLE.search(n)):
            continue
        m = trimesh.load(f)
        m.merge_vertices()
        v = m.vertices - OFF
        v[:, 0] *= -1
        v[:, 1] *= -1                     # half turn about z: a rotation, so the winding still holds
        PARTS[n] = v
        PARTS[n + "\0faces"] = m.faces

    if not PARTS:
        sys.exit(f"no parts found in {D!r}")

    sc = trimesh.Scene()
    counts, surfs = {}, {}
    for n in [k for k in PARTS if "\0" not in k]:
        v, Fc = PARTS[n], PARTS[n + "\0faces"]
        c = v.mean(axis=0)
        g = next((grp for pat, grp in BY_NAME if re.match(pat, n)), None) or by_position(n, c)
        if g is None:                     # rod ends and other hardware: go with the nearest hardpoint
            i = int(np.argmin(np.linalg.norm(APTS - c, axis=1)))
            g = AGRP[i]
        t = 0.85 if "Chassis" in n else 0.6 if ("Tire" in n or len(Fc) > 3000) else 0
        if t:
            v, Fc = fs.simplify(v.astype(np.float32), Fc.astype(np.int32), target_reduction=t)
        surf = next((cls for pat, cls in SURFACE if re.search(pat, n, re.I)), "steel")
        v, Fc, N = crease_normals(v, Fc)
        node = g + "--" + surf + "--" + n
        sc.add_geometry(trimesh.Trimesh(v, Fc, vertex_normals=N, process=False),
                        node_name=node, geom_name=node)
        counts[g] = counts.get(g, 0) + 1
        surfs[surf] = surfs.get(surf, 0) + 1

    sc.export(OUT, include_normals=True)
    print(f"wrote {os.path.normpath(OUT)}  ({os.path.getsize(OUT)/1e6:.1f} MB, "
          f"{len(counts)} groups, {sum(counts.values())} parts)")
    for g in sorted(counts):
        print(f"  {g:10s} {counts[g]:3d}")
    print("surfaces: " + ", ".join(f"{k} {v}" for k, v in sorted(surfs.items())))


if __name__ == "__main__":
    main()
