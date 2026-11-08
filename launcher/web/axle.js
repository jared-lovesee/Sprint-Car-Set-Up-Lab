// Sprint car suspension kinematics.
//
// Both ends of a sprint car are a rigid axle on links, so there is one solver here and
// both ends use it: prescribe the axle's heave and roll relative to the chassis, then
// solve the rest of its pose from the link lengths.
//
//   front  beam axle, three radius rods (the left upper position is empty on this car)
//          plus a track bar  ->  4 constraints on 6 axle DOF = the 2 we prescribe.
//          Steering is a drag link from the pitman arm to the LF steering arm, then a
//          tie rod across to the RF, so the front steers itself as the axle moves.
//
//   rear   Winters axle, a top radius rod and a torsion-bar arm per side (both on a
//          birdcage that is free to turn on the axle tube) plus a Jacobs ladder.
//          6 constraints, and the two birdcage rotations are unknowns too, so again
//          8 unknowns - 6 constraints = the 2 we prescribe.
//
// Frame: x forward, y left, z up, inches. + camber = top of the tyre out, + toe = out.
(function (root) {

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  mid: (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
};
const D = 180 / Math.PI;
const clone = o => JSON.parse(JSON.stringify(o));

// rotate p about the axis through o with unit direction k, by t (Rodrigues)
function rot(p, o, k, t) {
  const v = V.sub(p, o), c = Math.cos(t), s = Math.sin(t);
  return V.add(o, V.add(V.add(V.mul(v, c), V.mul(V.cross(k, v), s)), V.mul(k, V.dot(k, v) * (1 - c))));
}
const rotVec = (v, k, t) => rot(v, [0, 0, 0], k, t);

// secant iterations on f(x)=0 near x0
function solve1(f, x0, h) {
  h = h || 1e-3;
  let a = x0, b = x0 + h, fa = f(a), fb = f(b);
  for (let i = 0; i < 40 && Math.abs(fb) > 1e-10; i++) {
    const d = fb - fa; if (Math.abs(d) < 1e-14) break;
    const c = b - fb * (b - a) / d; a = b; fa = fb; b = c; fb = f(b);
  }
  return b;
}
// Gaussian elimination with partial pivoting, any size
function solveN(M, r) {
  const n = r.length, A = M.map((row, i) => [...row, r[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
    [A[i], A[p]] = [A[p], A[i]];
    if (Math.abs(A[i][i]) < 1e-14) return null;
    for (let j = i + 1; j < n; j++) {
      const f = A[j][i] / A[i][i];
      for (let k = i; k <= n; k++) A[j][k] -= f * A[i][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let t = A[i][n]; for (let k = i + 1; k < n; k++) t -= A[i][k] * x[k]; x[i] = t / A[i][i]; }
  return x;
}
// Damped Newton on f(u)=0 with a numeric Jacobian. With more residuals than unknowns it
// falls back to least squares (normal equations), which is what the rear needs: its links
// over-constrain the axle by one, and the leftover is the real bind in the linkage.
function newton(f, u0, n) {
  let u = u0.slice();
  for (let it = 0; it < 60; it++) {
    const f0 = f(u);
    let worst = 0; for (const v of f0) worst = Math.max(worst, Math.abs(v));
    if (worst < 1e-10) break;
    const J = f0.map(() => new Array(n).fill(0));
    for (let j = 0; j < n; j++) {
      const up = u.slice(); const h = 1e-6 * (1 + Math.abs(u[j])); up[j] += h;
      const fp = f(up);
      for (let i = 0; i < f0.length; i++) J[i][j] = (fp[i] - f0[i]) / h;
    }
    let A, b;
    if (f0.length === n) { A = J; b = f0.map(v => -v); }
    else {
      A = Array.from({ length: n }, (_, i) => Array.from({ length: n },
        (_, j) => J.reduce((s, row) => s + row[i] * row[j], 0)));
      b = Array.from({ length: n }, (_, i) => -J.reduce((s, row, k) => s + row[i] * f0[k], 0));
      for (let i = 0; i < n; i++) A[i][i] += 1e-12;
    }
    const d = solveN(A, b);
    if (!d) break;
    let step = 1, m = 0; for (const v of d) m = Math.max(m, Math.abs(v));
    if (m > 0.5) step = 0.5 / m;                      // keep the first iterations sane
    for (let j = 0; j < n; j++) u[j] += d[j] * step;
  }
  return u;
}
// Solve, and if the guess led somewhere bad, walk in from the ride-height pose instead.
function track(f, n, guess, steps) {
  let u = newton(f, guess ? guess.slice() : new Array(n).fill(0), n);
  const err = uu => Math.max(...f(uu).map(Math.abs));
  if (err(u) > 1e-6 && guess) {
    const u2 = newton(f, new Array(n).fill(0), n);
    if (err(u2) < err(u)) u = u2;
  }
  return u;
}

// rigid transform: roll about x, then pitch about y, then yaw about z, all about O, plus t
function rigid(O, t, r) {
  const [cx, sx] = [Math.cos(r[0]), Math.sin(r[0])];
  const [cy, sy] = [Math.cos(r[1]), Math.sin(r[1])];
  const [cz, sz] = [Math.cos(r[2]), Math.sin(r[2])];
  // R = Rz * Ry * Rx
  const R = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
  const f = p => {
    const v = V.sub(p, O);
    return [
      O[0] + t[0] + R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
      O[1] + t[1] + R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
      O[2] + t[2] + R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
    ];
  };
  f.dir = d => [R[0][0] * d[0] + R[0][1] * d[1] + R[0][2] * d[2],
                R[1][0] * d[0] + R[1][1] * d[1] + R[1][2] * d[2],
                R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]];
  return f;
}

// ---------------------------------------------------------------- front axle

// adj: rodCz[i], rodAz[i] (each rod's chassis / axle end up), tbA, tbC (track bar ends up),
//      drag (drag link outer end up), tieL, tieR (tie rod ends up), toe (static toe-out, in)
const FADJ0 = { rodCz: [0, 0, 0], rodCx: [0, 0, 0], rodAz: [0, 0, 0], tbA: 0, tbC: 0, drag: 0, tieL: 0, tieR: 0,
                caster: [0, 0], camber: [0, 0], dragLen: 0, tieLen: 0, pitmanHole: 0 };

function buildFront(hp, adj) {
  adj = Object.assign({}, FADJ0, adj || {});
  const f = clone(hp.front);
  const c = { kind: 'front', hp: f, dims: hp.dims };
  // moved pivots. Link lengths are taken AFTER the move, so the axle stays where the CAD put it.
  c.links = f.rods.map((r, i) => ({
    name: r.name, side: r.side,
    c: [r.chassis[0] + adj.rodCx[i], r.chassis[1], r.chassis[2] + adj.rodCz[i]],   // rodCx: + = forward
    a: [r.axle[0], r.axle[1], r.axle[2] + adj.rodAz[i]],
  }));
  c.tb = { a: [f.trackBar.axle[0], f.trackBar.axle[1], f.trackBar.axle[2] + adj.tbA],
           c: [f.trackBar.chassis[0], f.trackBar.chassis[1], f.trackBar.chassis[2] + adj.tbC] };
  c.links.push({ name: 'TB', side: 'TB', c: c.tb.c, a: c.tb.a });
  c.links.forEach(l => l.L = V.dist(l.a, l.c));

  c.O = V.mid(f.wheel.L.c, f.wheel.R.c);
  c.axleAxis = V.norm(V.sub(f.wheel.L.c, f.wheel.R.c));
  // steering points, with the shims applied
  const st = f.steer;
  c.box = st.box;
  // which hole the drag link picks up on the pitman arm, along the arm from the box.
  // + = further out: a longer arm, so the drag link moves further per degree of pitman and
  // the steering quickens, and it is a strong bump steer adjuster because the arm hangs down.
  c.pitman0 = adj.pitmanHole
    ? V.add(st.box, V.mul(V.norm(V.sub(st.pitman, st.box)),
                          V.dist(st.pitman, st.box) + adj.pitmanHole))
    : st.pitman;
  c.pitmanArm = V.dist(c.pitman0, c.box);
  c.dragOuter = [st.dragOuter[0], st.dragOuter[1], st.dragOuter[2] + adj.drag];
  c.tieL = [st.tieL[0], st.tieL[1], st.tieL[2] + adj.tieL];
  c.tieR = [st.tieR[0], st.tieR[1], st.tieR[2] + adj.tieR];
  c.kp = { L: clone(f.kingpin.L), R: clone(f.kingpin.R) };
  c.wheel = { L: clone(f.wheel.L), R: clone(f.wheel.R) };
  // Caster and camber at the axle end. Both tilt the whole end of the tube, so the kingpin
  // and the steering arm go with them - camber on a beam axle is the ends of the axle
  // tilting in, not the wheel being tipped on its own. That means camber takes KPI with it
  // the other way and leaves the included angle where it was, and it is also why changing
  // either one moves the bump steer.
  // knuckleRef: three points that start where the 3D meshes are and get carried through
  // the tilt with everything else, so the spindle and tyre in the viewer end up cambered
  // and castered too, not just the numbers.
  c.knuckleRef = {};
  ['L', 'R'].forEach((s, i) => {
    const sg = s === 'L' ? 1 : -1, p = f.kingpin[s].p;
    c.knuckleRef[s] = [p.slice(), V.add(p, V.mul(f.kingpin[s].dir, 6)), f.wheel[s].c.slice()];
    // turn the END OF THE AXLE, about where the kingpin crosses the tube centreline.
    // Pivoting anywhere else swings the spindle off its mounting.
    const bend = c.kp[s].bend || c.kp[s].p;
    const tilt = (k, t) => {
      const o = bend;
      c.kp[s].dir = rotVec(c.kp[s].dir, k, t);
      c.wheel[s].c = rot(c.wheel[s].c, o, k, t);
      c.wheel[s].axis = rotVec(c.wheel[s].axis, k, t);
      c.knuckleRef[s] = c.knuckleRef[s].map(q => rot(q, o, k, t));
      if (s === 'L') { c.dragOuter = rot(c.dragOuter, o, k, t); c.tieL = rot(c.tieL, o, k, t); }
      else c.tieR = rot(c.tieR, o, k, t);
    };
    if (adj.caster[i]) tilt([0, 1, 0], -adj.caster[i] / D);
    if (adj.camber[i]) tilt([1, 0, 0], -sg * adj.camber[i] / D);
  });
  // Drag link and crossover (tie rod) lengths: the two bars you turn on the car. The drag
  // link aims the LF, the crossover then sets the RF against it, which is the toe.
  c.Ltie = V.dist(c.tieL, c.tieR) + adj.tieLen;
  c.Ldrag = V.dist(c.dragOuter, c.pitman0) + adj.dragLen;
  // torsion arms: the free end rides with the axle
  c.bar = { L: clone(f.bar.L), R: clone(f.bar.R) };
  c.shock = clone(f.shock);
  return c;
}

// h = axle vertical relative to the chassis (+ = bump), psi = axle roll relative to the
// chassis (+ = left side up), pitmanDeg = pitman arm angle (+ = steer left)
function poseFrontRaw(c, h, psi, steer, guess) {
  const f = u => {
    const T = rigid(c.O, [u[0], u[1], h], [psi, u[2], u[3]]);
    return c.links.map(l => V.dist(T(l.a), l.c) ** 2 - l.L * l.L);
  };
  const u = track(f, 4, guess && guess.u);
  const T = rigid(c.O, [u[0], u[1], h], [psi, u[2], u[3]]);
  const p = { u, h, psi, T, res: Math.max(...f(u).map(Math.abs)) };

  // everything the axle carries
  p.kp = { L: { p: T(c.kp.L.p), dir: T.dir(c.kp.L.dir) }, R: { p: T(c.kp.R.p), dir: T.dir(c.kp.R.dir) } };
  p.links = c.links.map(l => ({ name: l.name, c: l.c, a: T(l.a) }));
  p.tb = { c: c.tb.c, a: T(c.tb.a) };
  p.bar = { L: { pivot: c.bar.L.pivot, arm: T(c.bar.L.arm) }, R: { pivot: c.bar.R.pivot, arm: T(c.bar.R.arm) } };
  p.shock = { L: { chassis: c.shock.L.chassis, axle: T(c.shock.L.axle) },
              R: { chassis: c.shock.R.chassis, axle: T(c.shock.R.axle) } };

  // steering: the pitman arm swings about a lateral axis on the chassis, so the drag link
  // pushes the LF knuckle fore and aft; the tie rod then carries it across to the RF.
  const pit = rot(c.pitman0, c.box, [0, 1, 0], -steer / D);
  const dragA = T(c.dragOuter), tieLA = T(c.tieL), tieRA = T(c.tieR);
  const thL = solve1(t => V.dist(rot(dragA, p.kp.L.p, p.kp.L.dir, t), pit) - c.Ldrag, guess ? guess.thL : 0);
  const spinL = q => rot(q, p.kp.L.p, p.kp.L.dir, thL);
  const tieLw = spinL(tieLA);
  const thR = solve1(t => V.dist(rot(tieRA, p.kp.R.p, p.kp.R.dir, t), tieLw) - c.Ltie, guess ? guess.thR : 0);
  const spinR = q => rot(q, p.kp.R.p, p.kp.R.dir, thR);
  p.thL = thL; p.thR = thR; p.pitman = pit;
  p.drag = { i: pit, o: spinL(dragA) };
  p.tie = { L: tieLw, R: spinR(tieRA) };
  p.wheel = {
    L: { c: spinL(T(c.wheel.L.c)), axis: rotVec(T.dir(c.wheel.L.axis), p.kp.L.dir, thL), r: c.wheel.L.r },
    R: { c: spinR(T(c.wheel.R.c)), axis: rotVec(T.dir(c.wheel.R.axis), p.kp.R.dir, thR), r: c.wheel.R.r },
  };
  return p;
}

// The slider is "steer at the LF", because that is what anyone setting a sprint car
// thinks in - but the pitman arm angle is what the linkage actually holds while the axle
// moves, which is why bump steer exists at all. So convert once, at ride height, then
// keep that pitman angle through travel.
function pitmanFor(c, steerLF) {
  if (!steerLF) return 0;
  const key = steerLF.toFixed(4);
  c._pit = c._pit || {};
  if (c._pit[key] == null) {
    const toeAt = pit => angles(poseFrontRaw(c, 0, 0, pit).wheel.L, 1).toe;
    const t0 = toeAt(0);
    c._pit[key] = solve1(pit => toeAt(pit) - (t0 + steerLF), steerLF / 2.7, 0.1);
  }
  return c._pit[key];
}
function poseFront(c, h, psi, steerLF, guess) {
  const p = poseFrontRaw(c, h, psi, pitmanFor(c, steerLF || 0), guess);
  p.steerLF = steerLF || 0;
  return p;
}

// ---------------------------------------------------------------- rear axle

// adj: rodCz[i], rodAz[i] (top rod ends up), index[i] (birdcage indexing, deg),
//      ladder: cUp,cLo,aUp,aLo (strap ends up)
const RADJ0 = { rodCz: [0, 0], rodCx: [0, 0], rodAz: [0, 0], rodLen: [0, 0],
                ladderRun: null, strap: null, clevis: 0, wheelL: 0, wheelR: 0,
                holePitch: 0.5, holeUpN: 0, holeLoN: 0 };

// Birdcage clocking: the angle the cage sits at on the axle tube, taken as the line from
// the torsion bar arm mount up to the radius rod mount, off vertical in side view.
// + = the top of the cage leans forward. This is an absolute angle, not a change: the CAD
// already has the cages clocked, and differently side to side.
const clocking = (rodMount, barMount) =>
  Math.atan2(rodMount[0] - barMount[0], rodMount[2] - barMount[2]) * D;
// Rear steer, deg: where the axle actually aims against the chassis centreline, + = aims
// right (LR ahead of RR), which loosens a left-turn car. Not the pose's yaw u[2]: that is
// measured from the axle as the CAD drew it (the rest pose already differs, the housing
// being centred) and is + counter-clockwise, which puts the RR ahead - the wrong sign.
const rearSteer = p => Math.atan2(p.axleAxis[0], p.axleAxis[1]) * D;

function buildRear(hp, adj) {
  adj = Object.assign({}, RADJ0, adj || {});
  const r = clone(hp.rear);
  const c = { kind: 'rear', hp: r, dims: hp.dims };
  c.O = V.mid(r.wheel.L.c, r.wheel.R.c);
  c.axleAxis = V.norm(V.sub(r.wheel.L.c, r.wheel.R.c));
  // Everything bolted to a birdcage turns with it on the axle tube. Indexing the birdcage
  // is turning it on the tube at rest: it swings the rod and bar-arm ears to new angles,
  // and the rod lengths are then re-set to put the axle back where it was.
  // + = the top of the cage goes forward.
  // The birdcage is one piece: its rod ear and bar-arm ear are at a fixed angle to each
  // other, and the cage turns on the tube. With the torsion arm a fixed length, where it
  // turns to is set by the arm and the top rod together - so clocking is something you set
  // by turning the rod ends, which is how rodLen works below.
  c.cage = ['L', 'R'].map((side, i) => ({
    side,
    rodC: [r.rods[i].chassis[0] + adj.rodCx[i], r.rods[i].chassis[1], r.rods[i].chassis[2] + adj.rodCz[i]],
    rodA: [r.rods[i].axle[0], r.rods[i].axle[1], r.rods[i].axle[2] + adj.rodAz[i]],
    barPivot: r.bar[side].pivot,
    barArm: r.bar[side].arm,
    shockC: r.shock[side].chassis,
    shockA: r.shock[side].arm,          // the rear shock picks up the torsion arm, not the cage
  }));
  // Moving a rod's mounting hole re-sets its length to hold the axle where it was; turning
  // the rod end in or out (rodLen) is a real length change, so the birdcage swings and the
  // axle moves. The torsion arm never changes length - it is splined to the bar and can only
  // slide along it - so its length is taken in side view, square to the bar.
  c.cage.forEach((g, i) => {
    g.Lrod = V.dist(g.rodA, g.rodC) + ((adj.rodLen && adj.rodLen[i]) || 0);
    g.Lbar = Math.hypot(g.barArm[0] - g.barPivot[0], g.barArm[2] - g.barPivot[2]);
  });
  c.clock0 = ['L', 'R'].map((side, i) => clocking(r.rods[i].axle, r.bar[side].arm));
  // ---- Jacobs ladder, built from the parts you would actually buy ----
  // The ladder is a triangle: a vertical member whose two holes pick up the straps, running
  // out to a clevis that pins to the right-rear hub. Catalogue ladders are quoted by their
  // long tube - 13 1/4, 13 5/8, 14 - and what that really sets is the horizontal run from
  // the vertical member to the clevis. The straps are a separate part, 6, 7 or 8 in.
  //
  // Three things hold for every configuration: the chassis bracket is welded where it is,
  // the clevis picks up the birdcage at the same place, and the housing sits centred in the
  // chassis. What gives is the HEIGHT of the strap holes on the bracket. With the triangle
  // at its drawn angle, each strap's chassis hole has to sit where a strap of the chosen
  // length reaches the bracket - two heights for two straps, solved directly. A long strap
  // and a short ladder can fail to reach at all; that is flagged, not hidden.
  const l = r.ladder;
  const run0 = ((l.axleUp[1] - l.pin[1]) + (l.axleLo[1] - l.pin[1])) / 2;
  const dRun = (adj.ladderRun == null ? run0 : adj.ladderRun) - run0;
  // triangle holes for the MIDDLE clevis hole - the chassis holes are chosen off these, so
  // picking a different clevis hole moves the triangle on the birdcage and nothing else
  const T1 = [l.axleUp[0], l.axleUp[1] + dRun, l.axleUp[2]];
  const T2 = [l.axleLo[0], l.axleLo[1] + dRun, l.axleLo[2]];
  // the CAD's 7 in straps measure 7.198 between centres, so carry that allowance across
  const L0 = (V.dist(l.axleUp, l.chassisUp) + V.dist(l.axleLo, l.chassisLo)) / 2;
  const Ls = (adj.strap == null ? 7 : adj.strap) + (L0 - 7);
  // the housing is centred, so at rest everything on it sits this far across from the CAD
  const centreShift = -(r.wheel.L.c[1] + r.wheel.R.c[1]) / 2;
  const yb = l.chassisUp[1];
  // lateral span each strap has to cover from the triangle out to the bracket, at rest,
  // with the housing moved `shift` to the right
  let shift = 0;
  const span = T => Math.abs(yb - (T[1] + centreShift - shift));
  // The clevis may move up to MOUNT_TOL out on the birdcage to let a strap that is just
  // too short reach - the "more or less the same" allowance. Past that the whole rear end
  // moves right toward the bracket until the longer strap lies flat (Jared), and the
  // wheels are put back with spacing by hand. Otherwise the housing stays centred.
  const MOUNT_TOL = 0.25;
  const need = Math.max(0, span(T1) - Ls, span(T2) - Ls);
  const mount = need > 0 ? Math.min(need, MOUNT_TOL) + 1e-6 : 0;
  shift = need > MOUNT_TOL ? need - MOUNT_TOL + 1e-6 : 0;
  const pin = [l.pin[0], l.pin[1] - mount, l.pin[2]];               // + mount = further out on the RR
  T1[1] -= mount; T2[1] -= mount;
  // where each strap would ideally bolt to put the housing dead centre...
  const ideal = (T, sign) => {
    const dy = span(T), q = Ls * Ls - dy * dy;
    return T[2] + sign * Math.sqrt(Math.max(q, 0));
  };
  const iu = ideal(T1, 1), il = ideal(T2, -1);
  // ...snapped to the bracket's holes (the CAD's own holes are on the pattern), then moved
  // by however many holes you ask. Off the ideal, the rear end goes where the straps put it.
  const pitch = adj.holePitch || 0.5;
  const snap = (z, z0, n) => z0 + (Math.round((z - z0) / pitch) + n) * pitch;
  const zu = snap(iu, l.chassisUp[2], adj.holeUpN), zl = snap(il, l.chassisLo[2], adj.holeLoN);
  // the clevis hole: the triangle sits that much higher or lower on the birdcage pin
  T1[2] += adj.clevis; T2[2] += adj.clevis;
  c.lad = {
    pin, aUp: T1, aLo: T2,
    cUp: [l.chassisUp[0], yb, zu], cLo: [l.chassisLo[0], yb, zl],
    run: run0 + dRun, strapNom: adj.strap == null ? 7 : adj.strap, mount, pitch,
    holeMove: [zu - l.chassisUp[2], zl - l.chassisLo[2]],
    idealMove: [iu - l.chassisUp[2], il - l.chassisLo[2]],
    holeN: [Math.round((zu - l.chassisUp[2]) / pitch), Math.round((zl - l.chassisLo[2]) / pitch)],
    reach: true, shift,       // shift: housing moved right of centre, in
  };
  c.lad.Lup = c.lad.Llo = Ls;
  // What gets centred in the chassis is the HOUSING, which is where the wheels sit before
  // any spacers - otherwise spacing one side would drag the whole rear end across with it.
  c.housingCentre = (r.wheel.L.c[1] + r.wheel.R.c[1]) / 2;
  // wheel spacers: the housing stays put and the wheels move out on it
  c.wheel = clone(r.wheel);
  c.wheel.L.c[1] += adj.wheelL;
  c.wheel.R.c[1] -= adj.wheelR;
  c.track = c.wheel.L.c[1] - c.wheel.R.c[1];
  return c;
}

// u = [tx, ty, yaw, birdcage L, birdcage R, ladder triangle].
//
// The housing's rotation about the axle tube is not a free variable. It does not move the
// wheels, and letting it float leaves the solve nearly singular, because the housing can
// turn while both birdcages turn back by the same amount.
//
// The Jacobs ladder's two straps do not run to the axle, they run to a triangle that is
// PINNED to the right-rear birdcage. That pin is the whole trick: it gives the ladder a
// joint of its own, so the axle can heave while both straps keep their length - the
// triangle just swings on the pin. So the triangle's swing angle is an unknown here, and
// the straps go in as two real length constraints, not as a lateral rule. Six unknowns,
// six constraints: four birdcage links and two straps. Where the two strap lines cross is
// the rear roll centre.
function poseRear(c, h, psi, guess) {
  const parts = u => {
    const T = rigid(c.O, [u[0], u[1], h], [psi, 0, u[2]]);
    const ax = T.dir(c.axleAxis), O = T(c.O);
    const rods = [];
    const cage = [];
    c.cage.forEach((g, i) => {
      const m = q => rot(T(q), O, ax, u[3 + i]);
      cage.push(m);
      rods.push(V.dist(m(g.rodA), g.rodC) - g.Lrod);
      // torsion arm: the ball stays its arm length from the bar's axis, anywhere along it
      const b = m(g.barArm);
      rods.push(Math.hypot(b[0] - g.barPivot[0], b[2] - g.barPivot[2]) - g.Lbar);
    });
    // The ladder hangs off the birdcage on a heim: only the pin POINT goes with the cage, the
    // cage's rotation does not. So the triangle is carried across to where the pin is and
    // swings in its own plane, square to the car, and never twists.
    const pin = cage[1](c.lad.pin), d = V.sub(pin, c.lad.pin);
    const tri = q => rot(V.add(q, d), pin, [1, 0, 0], u[5]);
    const lad = { cUp: c.lad.cUp, cLo: c.lad.cLo, aUp: tri(c.lad.aUp), aLo: tri(c.lad.aLo), pin, tri };
    return { rods, straps: [V.dist(lad.aUp, lad.cUp) - c.lad.Lup, V.dist(lad.aLo, lad.cLo) - c.lad.Llo],
             lad, T, ax, O };
  };
  const f = u => { const q = parts(u); return [...q.rods, ...q.straps]; };
  const u = track(f, 6, guess && guess.u);
  const q = parts(u);
  const T = q.T, ax = q.ax, O = q.O;
  const p = { u, h, psi, T, axleAxis: ax, O, triAng: u[5] * D,
              res: Math.max(...q.rods.map(Math.abs), ...q.straps.map(Math.abs)) };
  p.cage = c.cage.map((g, i) => {
    const m = q => rot(T(q), O, ax, u[3 + i]);
    const rodA = m(g.rodA), barArm = m(g.barArm);
    // the arm slides along the bar to stay in line with its ball, and turns about the bar
    const slide = barArm[1] - g.barArm[1];
    const pivot = [g.barPivot[0], g.barPivot[1] + slide, g.barPivot[2]];
    const turn = Math.atan2(barArm[2] - pivot[2], barArm[0] - pivot[0]) -
                 Math.atan2(g.barArm[2] - g.barPivot[2], g.barArm[0] - g.barPivot[0]);
    const onArm = q => {             // a point fixed to the arm, e.g. the shock's lower mount
      const x = q[0] - g.barPivot[0], z = q[2] - g.barPivot[2], c = Math.cos(turn), s = Math.sin(turn);
      return [pivot[0] + x * c - z * s, q[1] + slide, pivot[2] + x * s + z * c];
    };
    return { side: g.side, ang: u[3 + i] * D, clock: clocking(rodA, barArm), rodC: g.rodC, rodA,
             barPivot: pivot, barArm, slide, armTurn: turn * D,
             shockC: g.shockC, shockA: onArm(g.shockA) };
  });
  p.lad = q.lad;
  p.wheel = { L: { c: T(c.wheel.L.c), axis: T.dir(c.wheel.L.axis), r: c.wheel.L.r },
              R: { c: T(c.wheel.R.c), axis: T.dir(c.wheel.R.axis), r: c.wheel.R.r } };
  return p;
}

// Torque tube. The rear half bolts to the housing nose, the front half carries the torque
// ball, held in the engine plate - a chassis point - and the two halves telescope. So the
// tube sets nothing about where the axle goes: it sets the HOUSING'S PITCH about the axle,
// the one rotation the birdcages leave free (they turn on the tube). Solve the pitch that
// points the bolted-on tube at the ball. dx moves the ball, + = forward.
// ponytail: the tube is aimed at the ball sideways too, as if the ball took up the housing's
// small yaw and side shift. A ball held solid sideways would fight the ladder and the rods.
function torqueTube(p, c, dx) {
  const t = c.hp.torqueTube; if (!t) return null;
  const ball = [t.ball[0] + (dx || 0), t.ball[1], t.ball[2]];
  const a = p.axleAxis, C = p.T(c.O);
  const f = V.norm(V.sub([1, 0, 0], V.mul(a, a[0]))), u = V.cross(f, a);
  const nose = ph => V.add(C, V.add(V.mul(a, t.noseLat),
    V.add(V.mul(f, t.noseR * Math.cos(ph)), V.mul(u, t.noseR * Math.sin(ph)))));
  const g = ph => { const d = V.sub(ball, nose(ph)); return Math.atan2(V.dot(d, u), V.dot(d, f)) - ph - t.delta / D; };
  const ph = solve1(g, t.phiDrawn / D, 0.01), N = nose(ph), dir = V.norm(V.sub(ball, N));
  return {
    ball, nose: N, dir, axis: a, centre: C,
    pitch: ph * D - t.phiDrawn,                  // housing turned from how car.glb draws it, + = nose up
    lever: V.dot(V.sub(ball, C), dir),           // axle to ball along the tube: the torque reaction's lever
    angle: Math.atan2(dir[2], Math.hypot(dir[0], dir[1])) * D,   // + = rising toward the ball
    overlap: t.L1 + t.L2 - V.dist(ball, N),      // how far the halves still overlap
    res: Math.abs(g(ph)),
  };
}

// ---------------------------------------------------------------- read-outs

// wheel angles for one corner. s = +1 left, -1 right. kp may be null (rear).
function angles(w, s, kp) {
  const a = V.norm(w.axis);
  const o = {
    camber: Math.asin(-a[2]) * D,
    toe: Math.atan2(-a[0], s * a[1]) * D,
  };
  // contact patch: straight down from the wheel centre, perpendicular to the spin axis
  const dn = V.norm(V.sub([0, 0, -1], V.mul(a, V.dot([0, 0, -1], a))));
  o.CP = V.add(w.c, V.mul(dn, w.r));
  if (kp) {
    const k = kp.dir[2] > 0 ? kp.dir : V.mul(kp.dir, -1);
    o.caster = Math.atan2(-k[0], k[2]) * D;
    o.kpi = Math.atan2(-s * k[1], k[2]) * D;
    const t = (o.CP[2] - kp.p[2]) / k[2];
    const G = V.add(kp.p, V.mul(k, t));              // where the kingpin line meets the patch plane
    o.scrub = s * (o.CP[1] - G[1]);
    o.trail = G[0] - o.CP[0];
  }
  return o;
}

// where a line through two points in the y-z plane crosses y = y0
function atY(A, B, y0) {
  const dy = B[1] - A[1];
  if (Math.abs(dy) < 1e-9) return null;
  const t = (y0 - A[1]) / dy;
  return A[2] + t * (B[2] - A[2]);
}
// front roll centre: a beam axle on a track bar rolls about the bar's line at the centreline
function frontRC(p) {
  const z = atY(p.tb.a, p.tb.c, 0);
  const u = V.sub(p.tb.a, p.tb.c);
  return z == null ? null : { y: 0, z, ratio: u[2] / u[1], ang: Math.atan2(u[2], Math.abs(u[1])) * D, len: V.len(u) };
}
// Jacobs ladder: the rear rolls about where the two straps cross
function ladderIC(p) {
  const A = p.lad.cUp, B = p.lad.aUp, C = p.lad.cLo, E = p.lad.aLo;
  const m1 = (B[2] - A[2]) / (B[1] - A[1]), m2 = (E[2] - C[2]) / (E[1] - C[1]);
  if (!isFinite(m1) || !isFinite(m2) || Math.abs(m1 - m2) < 1e-9) return null;
  const y = (C[2] - A[2] + m1 * A[1] - m2 * C[1]) / (m1 - m2);
  return { y, z: A[2] + m1 * (y - A[1]),
           angUp: Math.atan2(B[2] - A[2], B[1] - A[1]) * D, angLo: Math.atan2(E[2] - C[2], E[1] - C[1]) * D };
}

// Anti-dive / anti-squat, %. It is the tangent of the side-view link angle, which is the
// same thing as how far the contact patch moves fore and aft per inch of vertical travel -
// so measure that from the solver and it works for any linkage, including this car's front
// end where the left side has one radius rod and the right side has two.
function antiPct(poseAt, side, s, wb, hcg, step) {
  step = step || 0.4;
  const a = angles(poseAt(step).wheel[side], s).CP, b = angles(poseAt(-step).wheel[side], s).CP;
  const dz = a[2] - b[2];
  if (Math.abs(dz) < 1e-9) return 0;
  return (a[0] - b[0]) / dz * (wb / hcg) * 100;
}

root.SC = { V, D, rot, rotVec, solve1, solveN, newton, rigid,
            buildFront, poseFront, poseFrontRaw, pitmanFor, buildRear, poseRear,
            angles, frontRC, ladderIC, clocking, rearSteer, antiPct, torqueTube, FADJ0, RADJ0 };
if (typeof module !== 'undefined' && module.exports) module.exports = root.SC;
})(typeof window !== 'undefined' ? window : globalThis);
