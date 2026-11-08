// Sprint Car Setup Lab. The kinematics live in axle.js; this file is the car model
// (loads, roll, jacking), the read-outs and the 3D.
'use strict';
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const V = SC.V, DEG = 180 / Math.PI, GSTEEL = 11.5e6;

let HP, F, R, MR, S, model = null;
let RBASE = { L: 15.06, R: 16.14 };   // as exported, before stagger is applied
const FADJ0 = { rodCz: [0, 0, 0], rodCx: [0, 0, 0], rodAz: [0, 0, 0], tbA: 0, tbC: 0, drag: 0, tieL: 0, tieR: 0,
                caster: [0, 0], camber: [0, 0], dragLen: 0, tieLen: 0, pitmanHole: 0 };
const RADJ0 = { rodCz: [0, 0], rodCx: [0, 0], rodAz: [0, 0], rodLen: [0, 0],
                ladderRun: 12.80, strap: 7, clevis: 0, wheelL: 0, wheelR: 0,
                holePitch: 0.5, holeUpN: 0, holeLoN: 0 };
let fadj = JSON.parse(JSON.stringify(FADJ0)), radj = JSON.parse(JSON.stringify(RADJ0));
let WB = 85.29, TF = 58.08, TR = 56.01, RT = 15.6;      // RT = mean rear tyre radius

// ---------------------------------------------------------------- 3D scene
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(35, 1, 1, 2000); cam.up.set(0, 0, 1);
const controls = new THREE.OrbitControls(cam, renderer.domElement); controls.target.set(0, 0, 14);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(80, 120, 200); scene.add(sun);
const world = new THREE.Group(); scene.add(world);      // tilted by the banking
const grid = new THREE.GridHelper(300, 30); grid.rotation.x = Math.PI / 2; world.add(grid);
// everything that is the car hangs off this, so the Dynamics tab can put it on the track
const carRoot = new THREE.Group(); carRoot.matrixAutoUpdate = false; world.add(carRoot);

// Colour says what a part DOES - sprung, link, unsprung, which is what the legend reads -
// and the surface says what it is MADE OF. Keeping those separate means a tyre can stop
// looking like chrome without breaking the colour coding the app teaches with.
// tools/make_model.py decides the surface and writes it into the node name.
const GBASE = g => /^(sprung|pitman|fbar|rbar)/.test(g) ? { v: '--steel', m: 0.30, r: 0.60 }
  : /^(faxle|fkn|raxle|rcage|rtyre|tt)/.test(g) ? { v: '--unsprung', m: 0.40, r: 0.50 }
  : { v: '--link', m: 0.20, r: 0.50 };
const SURF = {
  steel: {},
  alloy: { m: 0.80, r: 0.30 },                       // cast and machined: shock bodies, the Winters case
  chrome: { m: 1.00, r: 0.08, fixed: '#c9d0d6' },    // shock shafts
  tyre: { m: 0.00, r: 0.95, fixed: '#17191b' },      // rubber: no metalness, and rough
};
const matCache = new Map();
function matFor(grp, cls) {
  const key = grp + '|' + cls;
  let m = matCache.get(key);
  if (m) return m;
  const base = GBASE(grp), s = SURF[cls] || {};
  m = new THREE.MeshStandardMaterial({
    metalness: s.m != null ? s.m : base.m,
    roughness: s.r != null ? s.r : base.r,
  });
  m.userData.tint = s.fixed || base.v;
  matCache.set(key, m);
  paintMat(m);
  return m;
}
const paintMat = m => m.color.set(m.userData.tint[0] === '#' ? m.userData.tint : css(m.userData.tint));
function themeMats() {
  scene.background = new THREE.Color(css('--panel'));
  for (const m of matCache.values()) paintMat(m);
  grid.material.color = new THREE.Color(css('--line'));
}
themeMats();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeMats);
new MutationObserver(themeMats).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// every group in car.glb, keyed by the prefix tools/make_model.py wrote into the node name
const G = {};

// ---------------------------------------------------------------- 3D helpers
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _tmp = new THREE.Matrix4();
// matrix mapping three points (and their plane normal) onto three new points
function affine(a, b, c, A, B, C, out) {
  const e1 = V.sub(b, a), e2 = V.sub(c, a), n = V.mul(V.norm(V.cross(e1, e2)), 5);
  const E1 = V.sub(B, A), E2 = V.sub(C, A), N = V.mul(V.norm(V.cross(E1, E2)), 5);
  _m1.set(e1[0], e2[0], n[0], a[0], e1[1], e2[1], n[1], a[1], e1[2], e2[2], n[2], a[2], 0, 0, 0, 1);
  _m2.set(E1[0], E2[0], N[0], A[0], E1[1], E2[1], N[1], A[1], E1[2], E2[2], N[2], A[2], 0, 0, 0, 1);
  return out.copy(_m2).multiply(_m1.invert());
}
const _vA = new THREE.Vector3(), _vB = new THREE.Vector3(), _q = new THREE.Quaternion();
// rigid move of a two-point part: pin a0 to a1, then swing it so a->b lines up again
function seg(a0, b0, a1, b1, out) {
  _vA.set(b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]).normalize();
  _vB.set(b1[0] - a1[0], b1[1] - a1[1], b1[2] - a1[2]).normalize();
  _q.setFromUnitVectors(_vA, _vB);
  out.makeRotationFromQuaternion(_q);
  out.setPosition(a1[0] - (out.elements[0] * a0[0] + out.elements[4] * a0[1] + out.elements[8] * a0[2]),
                  a1[1] - (out.elements[1] * a0[0] + out.elements[5] * a0[1] + out.elements[9] * a0[2]),
                  a1[2] - (out.elements[2] * a0[0] + out.elements[6] * a0[1] + out.elements[10] * a0[2]));
  return out;
}
const _sc = new THREE.Matrix4(), _tA = new THREE.Matrix4(), _tB = new THREE.Matrix4(), _rot = new THREE.Matrix4();
// Two-point part whose length is allowed to change: pin a0 to a1, swing a0->b0 onto
// a1->b1, and stretch along its own axis so the far end lands exactly on b1. Anything
// with threaded ends or bolt holes gets this - radius rods, the track bar, the steering
// links, the ladder straps - so both ends stay concentric with their holes when a hole is
// moved or, in the straps' case, when travel changes the span. Shocks telescope and the
// forged torsion arms swing, so those keep seg(), which does not stretch.
function stretch(a0, b0, a1, b1, out) {
  _vA.set(b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]);
  _vB.set(b1[0] - a1[0], b1[1] - a1[1], b1[2] - a1[2]);
  const L0 = _vA.length(), L1 = _vB.length();
  if (L0 < 1e-9 || L1 < 1e-9) return seg(a0, b0, a1, b1, out);
  _vA.multiplyScalar(1 / L0); _vB.multiplyScalar(1 / L1);
  _q.setFromUnitVectors(_vA, _vB);
  // I + k.ee': scale along the part's own axis only, so the tube stretches without fattening
  const k = L1 / L0 - 1, x = _vA.x, y = _vA.y, z = _vA.z;
  _sc.set(1 + k * x * x, k * x * y, k * x * z, 0,
          k * y * x, 1 + k * y * y, k * y * z, 0,
          k * z * x, k * z * y, 1 + k * z * z, 0,
          0, 0, 0, 1);
  _rot.makeRotationFromQuaternion(_q);
  _tA.makeTranslation(-a0[0], -a0[1], -a0[2]);
  _tB.makeTranslation(a1[0], a1[1], a1[2]);
  return out.copy(_tB).multiply(_rot).multiply(_sc).multiply(_tA);
}
const _sc2 = new THREE.Matrix4(), _tmp2 = new THREE.Matrix4();
// Resize a wheel about its centre, perpendicular to its spin axis: a bigger tyre is
// bigger in diameter, not in section width. S = I + (k-1)(I - aa')
function tyreScale(centre, axis, k, out) {
  _vA.set(axis[0], axis[1], axis[2]).normalize();
  const m = k - 1, x = _vA.x, y = _vA.y, z = _vA.z;
  _sc2.set(1 + m * (1 - x * x), -m * x * y, -m * x * z, 0,
           -m * y * x, 1 + m * (1 - y * y), -m * y * z, 0,
           -m * z * x, -m * z * y, 1 + m * (1 - z * z), 0,
           0, 0, 0, 1);
  _tA.makeTranslation(-centre[0], -centre[1], -centre[2]);
  _tB.makeTranslation(centre[0], centre[1], centre[2]);
  return out.copy(_tB).multiply(_sc2).multiply(_tA);
}
function setGroup(name, m) { const g = G[name]; if (g) for (const o of g) o.matrix.copy(m); }
function setGroupB(name, B, m) { const g = G[name]; if (!g) return; _tmp.multiplyMatrices(B, m); for (const o of g) o.matrix.copy(_tmp); }

// ---------------------------------------------------------------- overlays
const TIRE = [[42.77, 29.70], [42.52, -28.38], [-42.92, 27.35], [-42.37, -28.67]];
const discs = [], tags = [];
TIRE.forEach(p => {
  const d = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: .75, depthWrite: false }));
  d.position.set(p[0], p[1], 0.05); world.add(d); discs.push(d);
  const t = document.createElement('div'); t.className = 'tag'; stage.appendChild(t); tags.push(t);
});
const line = (col, dash) => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const m = dash ? new THREE.LineDashedMaterial({ color: col, dashSize: 1.4, gapSize: .9 }) : new THREE.LineBasicMaterial({ color: col });
  const l = new THREE.Line(g, m); l.visible = false; world.add(l); return l;
};
const dot = (col, r) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r || 1.1, 20, 16), new THREE.MeshBasicMaterial({ color: col }));
  m.visible = false; world.add(m); return m;
};
const ACC = 0x1864ab, LNK = 0xe8590c, GRN = 0x2b8a3e;
const axisLine = line(ACC), tbLine = line(ACC, true), ladU = line(ACC, true), ladL = line(ACC, true);
const kpLine = { L: line(LNK), R: line(LNK) };
const rcF = dot(ACC), rcR = dot(ACC), cgDot = dot(ACC, 1.5);
const wingDot = dot(LNK, 2.2), fwingDot = dot(LNK, 2.2); wingDot.visible = fwingDot.visible = true;
const jackArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 10, GRN, 3, 2);
jackArrow.visible = false; world.add(jackArrow);
axisLine.visible = true;

function view(p, t) { cam.position.set(p[0], p[1], p[2]); if (t) controls.target.set(t[0], t[1], t[2]); controls.update(); }
$('v-front').onclick = () => view([230, 0, 30], [30, 0, 14]);
$('v-34').onclick = () => view([170, -150, 100], [0, 0, 14]);
$('v-top').onclick = () => view([0, -1, 280], [0, 0, 14]);
$('v-side').onclick = () => view([0, -260, 25], [0, 0, 14]);
$('v-rear').onclick = () => view([-200, 0, 30], [-30, 0, 14]);

// ---------------------------------------------------------------- model build
function buildAll() {
  // Stagger is a tyre, not a number in a formula: it sets the LR, with the RR left alone.
  // Everything downstream follows - the rear axle has to tilt to keep both tyres on the
  // ground, which moves the settle, the roll centre and the corner weights.
  HP.rear.wheel.L.r = +(HP.rear.wheel.R.r - v('stg') / (2 * Math.PI)).toFixed(4);
  RT = (HP.rear.wheel.L.r + HP.rear.wheel.R.r) / 2;
  R = SC.buildRear(HP, radj);
  TR = R.track;
  // Centre the steering at ride height the way you would on the car: length the drag link
  // until the fronts point straight. Total toe stays with the tie rod. The drag link slider
  // is a trim from here. Twice round because the wheel aim moves the settle a touch.
  const front = len => SC.buildFront(HP, Object.assign({}, fadj, { dragLen: len }));
  const aim = c => { const p = SC.poseFront(c, -Z.dzF, -Z.phi, 0);
    return (SC.angles(p.wheel.L, 1).toe - SC.angles(p.wheel.R, -1).toe) / 2; };   // + = pointing left
  for (let i = 0; i < 2; i++) {
    F = front(dragAuto); S = settleCar(); Z = rideSet();
    const len = SC.solve1(l => aim(front(l)), dragAuto, 0.05);
    if (isFinite(len)) dragAuto = len;
  }
  F = front(dragAuto + fadj.dragLen); S = settleCar(); Z = rideSet();
  const p0 = poseF(-Z.dzF, -Z.phi, 0), r0 = poseR(-Z.dzR, -Z.phi);
  const fu = poseF(-Z.dzF + 0.4, -Z.phi, 0, p0), fd = poseF(-Z.dzF - 0.4, -Z.phi, 0, p0);
  const ru = poseR(-Z.dzR + 0.4, -Z.phi, r0), rd = poseR(-Z.dzR - 0.4, -Z.phi, r0);
  MR = { arm: {}, shock: {} };
  for (const s of ['L', 'R']) {
    const dw = fu.wheel[s].c[2] - fd.wheel[s].c[2];
    MR.arm[s + 'F'] = (fu.bar[s].arm[2] - fd.bar[s].arm[2]) / dw;
    MR.shock[s + 'F'] = -(V.dist(fu.shock[s].chassis, fu.shock[s].axle) - V.dist(fd.shock[s].chassis, fd.shock[s].axle)) / dw;
    const i = s === 'L' ? 0 : 1, dwr = ru.wheel[s].c[2] - rd.wheel[s].c[2];
    MR.arm[s + 'R'] = (ru.cage[i].barArm[2] - rd.cage[i].barArm[2]) / dwr;
    MR.shock[s + 'R'] = -(V.dist(ru.cage[i].shockC, ru.cage[i].shockA) - V.dist(rd.cage[i].shockC, rd.cage[i].shockA)) / dwr;
  }
  // torsion arm lever: perpendicular distance from the bar axis to the arm end
  MR.lever = {
    LF: V.dist(F.bar.L.pivot, F.bar.L.arm), RF: V.dist(F.bar.R.pivot, F.bar.R.arm),
    LR: V.dist(R.cage[0].barPivot, R.cage[0].barArm), RR: V.dist(R.cage[1].barPivot, R.cage[1].barArm),
  };
  MR.base = { f: p0, r: r0 };
  guessF = guessR = null;
}
let guessF = null, guessR = null, Z = null, dragAuto = 0;

// The CAD is not drawn sitting on the ground: its four contact patches span a couple of
// inches, and no amount of moving the car as one lump fixes that - the patches are not
// coplanar, so the suspension has to articulate. Part of the spread is real (the RR tyre
// is an inch bigger in radius, so a staggered axle on flat ground IS tilted) and part is
// just how the assembly was drawn. Each axle has exactly the two freedoms needed to sort
// it out, heave and roll, and two patches to land, so solve for them once and treat that
// as the car's reference pose. Everything else - travel, ride height, roll - is measured
// from there, and poseF / poseR below take their arguments in that frame.
// Sit the car on the ground the way it actually does: the SUSPENSION stays where the CAD
// drew it - that position is the design, not something to be corrected - and the CHASSIS
// finds its height, pitch and roll. The one thing that does have to articulate is the rear
// axle's roll, because the RR tyre is an inch bigger in radius and a staggered axle cannot
// sit square on flat ground. Four unknowns, four contact patches.
const BSET = new THREE.Matrix4(), _bq = new THREE.Matrix4();
function chassisXform(out, z, pitch, roll) {
  out.makeRotationX(roll);
  _bq.makeRotationY(pitch);
  out.premultiply(_bq);
  out.premultiply(_bq.makeTranslation(0, 0, z));
  return out;
}
function settleCar() {
  const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
  const patches = psiR => {
    const p = SC.poseFront(F, 0, 0, 0), r = SC.poseRear(R, 0, psiR);
    return [SC.angles(p.wheel.L, 1).CP, SC.angles(p.wheel.R, -1).CP,
            SC.angles(r.wheel.L, 1).CP, SC.angles(r.wheel.R, -1).CP];
  };
  const f = u => {
    chassisXform(_m, u[0], u[1], u[2]);
    return patches(u[3]).map(q => _v.set(q[0], q[1], q[2]).applyMatrix4(_m).z);
  };
  const u = SC.newton(f, [0, 0, 0, 0], 4);
  chassisXform(BSET, u[0], u[1], u[2]);
  return { z: u[0], pitch: u[1], roll: u[2], psiR: u[3], res: Math.max(...f(u).map(Math.abs)) };
}
// Ride height: ground to the lowest part of the chassis at each corner (hp.chassis.ride).
// The frame is one rigid piece, so LF, RF and RR set the body plane and the LR floats. This
// turns the three into the body pose that puts them there - dzF / dzR at the axles and phi,
// the same terms as everything else, measured from the settled car.
const num = id => { const x = $(id).value; return x === '' || isNaN(x) ? +DEF[id] : +x; };   // half-typed box: its default
function rideSet() {
  const c = (HP.chassis || HP0.chassis).ride, xr = TIRE[2][0], xf = TIRE[0][0], _v = new THREE.Vector3();
  const pts = ['LF', 'RF', 'LR', 'RR'].map(k => {
    const p = c[k]; return { x: p[0], y: p[1], h0: _v.set(p[0], p[1], p[2]).applyMatrix4(BSET).z };
  });
  const three = [[pts[0], num('hlf')], [pts[1], num('hrf')], [pts[3], num('hrr')]];
  const [a, b, phi] = solve3(three.map(([q]) => [1, q.x - xr, q.y]), three.map(([q, h]) => h - q.h0));
  const lr = pts[2].h0 + a + b * (pts[2].x - xr) + phi * pts[2].y;
  return { dzF: a + b * (xf - xr), dzR: a, phi, lr, pts, h: [num('hlf'), num('hrf'), lr, num('hrr')] };
}
// what a gauge on the car reads: body roll (+ left up) and pitch (+ nose down), deg, with
// the settle in them. Alignment comes out of the solver in the chassis frame.
const toGnd = (zF, zR, roll) => ({ roll: (roll + S.roll) * DEG,
  pitch: (Math.atan2(zR - zF, TIRE[0][0] - TIRE[2][0]) + S.pitch) * DEG });
// travel is measured from the CAD position of the suspension, with the rear carrying the
// static roll the stagger puts in it
const poseF = (h, psi, steer, guess) => SC.poseFront(F, h, psi, steer, guess);
const poseR = (h, psi, guess) => SC.poseRear(R, h, S.psiR + psi, guess);

// wheel rate from a torsion bar, lb/in
function wheelRate(dia, len, lever, mr) {
  const J = Math.PI * Math.pow(dia, 4) / 32;
  return (GSTEEL * J / len) / (lever * lever) * mr * mr;
}
const armRate = (dia, len, lever) => (GSTEEL * Math.PI * Math.pow(dia, 4) / 32 / len) / (lever * lever);

// ---------------------------------------------------------------- setup solve
function solve3(M, r) {
  const A = M.map((row, i) => [...row, r[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i; for (let j = i + 1; j < 3; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
    [A[i], A[p]] = [A[p], A[i]];
    for (let j = i + 1; j < 3; j++) { const f = A[j][i] / A[i][i]; for (let k = i; k < 4; k++) A[j][k] -= f * A[i][k]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let t = A[i][3]; for (let k = i + 1; k < 3; k++) t -= A[i][k] * x[k]; x[i] = t / A[i][i]; }
  return x;
}
function bisect(f, lo, hi) { let flo = f(lo); for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, fm = f(m); if ((fm > 0) === (flo > 0)) { lo = m; flo = fm; } else hi = m; } return (lo + hi) / 2; }
const mu = Fz => Math.max(0.6, 1.5 - 0.0004 * Fz);
const v = id => +$(id).value;

// Centre of pressure = the centre of each wing's main panel, on its top surface, measured off
// wing.glb (top panel x -41.3..13.2, y -29.8..30.2; front panel x 40.2..61.0, y -17.8..18.2).
// The position sliders move it with the wing, + = forward.
const WING_CP = [-14.05, 0.2, 77.4], FWING_CP = [50.6, 0.2, 35.6];
const wingX = () => WING_CP[0] + v('wingp');
const fwingX = () => FWING_CP[0] + v('fwingp');
const fwingFront = () => (fwingX() - TIRE[2][0]) / (TIRE[0][0] - TIRE[2][0]);   // share on the front axle (over 1 ahead of it)
const wingRear = () => (TIRE[0][0] - wingX()) / (TIRE[0][0] - TIRE[2][0]);   // share on the rear axle, by lever
function calc() {
  const W = v('wt'), ay = v('g'), gx = v('gx'), h = v('cg'), bf = v('bb') / 100;
  // banking, rising to the right: cornering g (horizontal) and gravity resolved into the track
  // surface. ayB is what the tires feel sideways, n the car's weight multiplier into the track.
  const bk = v('bank') / DEG, n = Math.cos(bk) + ay * Math.sin(bk), ayB = ay * Math.cos(bk) - Math.sin(bk);
  const ls = v('ls') / 100, rp = v('rp') / 100, cr = v('cr') / 100;
  const Uf = v('unf'), Ur = v('unr'), blen = v('blen');
  const steer = v('k-steer');
  const won = $('winged').checked, wing = won ? v('wing') : 0, wingR = wingRear(), fw = won ? v('fwing') : 0, fwF = fwingFront();
  const dia = { LF: v('dlf'), RF: v('drf'), LR: v('dlr'), RR: v('drr') };
  // rounds on the bar stop bolt: one round is 1/TPI inches at the arm. + = in, corner goes up; out lowers it
  const tpi = v('tpi') > 0 ? v('tpi') : 8, rnd = ['rnlf', 'rnrf', 'rnlr', 'rnrr'].map(id => (v(id) || 0) / tpi);
  const pre = { LF: rnd[0], RF: rnd[1], LR: rnd[2], RR: rnd[3] };
  const k = {}, ka = {};
  for (const c of ['LF', 'RF', 'LR', 'RR']) {
    k[c] = wheelRate(dia[c], blen, MR.lever[c], MR.arm[c[0] + c[1]]);
    ka[c] = armRate(dia[c], blen, MR.lever[c]);
  }
  // static corner weights from the scales, plus the wing
  const Wt = W + wing + fw;
  const L = W * ls, Fr = W * (1 - rp), X = W * cr;
  const base = [(L + Fr - X) / 2, 0, 0, 0];
  base[1] = Fr - base[0]; base[2] = L - base[0]; base[3] = W - base[0] - base[1] - base[2];
  for (let i = 0; i < 4; i++) base[i] *= n;          // the wing is not weight, so it is added after
  base[0] += wing * (1 - wingR) / 2; base[1] += wing * (1 - wingR) / 2;
  base[2] += wing * wingR / 2; base[3] += wing * wingR / 2;
  base[0] += fw * fwF / 2; base[1] += fw * fwF / 2; base[2] += fw * (1 - fwF) / 2; base[3] += fw * (1 - fwF) / 2;

  // corners LF, RF, LR, RR: c = +1 right, a = half track, seat = rounds as a wheel offset
  const C = [
    { k: k.LF, a: TF / 2, c: -1, seat: pre.LF / MR.arm.LF, x: WB },
    { k: k.RF, a: TF / 2, c: 1, seat: pre.RF / MR.arm.RF, x: WB },
    { k: k.LR, a: TR / 2, c: -1, seat: pre.LR / MR.arm.LR, x: 0 },
    { k: k.RR, a: TR / 2, c: 1, seat: pre.RR / MR.arm.RR, x: 0 },
  ];
  // at rest: rounds on a rigid chassis (heave, roll, pitch)
  const M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r3 = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const gi = [1, C[i].c * C[i].a, C[i].x];
    for (let row = 0; row < 3; row++) { for (let col = 0; col < 3; col++) M3[row][col] += C[i].k * gi[row] * gi[col]; r3[row] -= C[i].k * gi[row] * C[i].seat; }
  }
  const [z0, p0, t0] = solve3(M3, r3);
  const dStatic = [0, 1, 2, 3].map(i => C[i].k * (z0 + C[i].c * C[i].a * p0 + C[i].x * t0 + C[i].seat));
  const corner = base.map((x, i) => x + dStatic[i]);
  // the same solve moves the body off the set ride heights, which is what they read now
  const rise = (x, y) => -z0 - t0 * (x - TIRE[2][0]) + p0 * y;
  const rest = { dzF: Z.dzF + rise(TIRE[0][0], 0), dzR: Z.dzR + rise(TIRE[2][0], 0), phi: Z.phi + p0,
                 hNow: Z.pts.map((q, i) => Z.h[i] + rise(q.x, q.y)), rnd };

  const travel = (i, phi, dz) => -dz + C[i].c * C[i].a * phi;      // + = bump, at the wheel
  const force = (i, t) => C[i].k * t;
  const Mf = (phi, z) => -force(0, travel(0, phi, z)) * C[0].a + force(1, travel(1, phi, z)) * C[1].a;
  const Mr = (phi, z) => -force(2, travel(2, phi, z)) * C[2].a + force(3, travel(3, phi, z)) * C[3].a;
  const Kf = (k.LF + k.RF) * (TF / 2) * (TF / 2), Kr = (k.LR + k.RR) * (TR / 2) * (TR / 2);

  const Wf = Fr + wing * (1 - wingR) + fw * fwF, Wr = Wt - Wf, Ws = Wt - Uf - Ur, aS = (Wr - Ur) / Ws;
  const hs0 = (Wt * h - (Uf + Ur) * RT) / Ws;       // the CG height you set is at ride height
  const dWx = Wt * gx * h / WB;

  // Torque tube: bolted to the rear end, its torque ball held in the engine plate, and the two
  // halves telescope - so it carries no fore-aft load, only the housing's reaction to the axle
  // torque (the birdcages turn on the tube, so the rods take none of it). On throttle the ball
  // pushes the chassis up by axle torque / lever, lever = axle to ball along the tube at this
  // pose, and the housing down by the same, so the rear springs carry that much less: the rear lifts.
  const gear = v('gear') > 0 ? v('gear') : 5.5, Teng = gx > 0 ? (v('etq') || 0) * 12 : 0;   // in-lb at the crank
  const tt = { L: 0, F: 0, T: 0, spin: false, tube: null };
  let phi = 0, zJF = 0, zJR = 0, dzF = rest.dzF, dzR = rest.dzR, hf = 6, hr = 18;
  let P = null, Rp = null, fj = { tot: 0 }, rj = { tot: 0 }, loads = base.slice(), dWf = 0, dWr = 0, ad = 0, asq = 0, sF = 0, sR = 0;
  for (let it = 0; it < 10; it++) {
    dzF = rest.dzF + zJF; dzR = rest.dzR + zJR;
    P = poseF(-dzF, -(rest.phi + phi), steer, guessF); guessF = P;
    Rp = poseR(-dzR, -(rest.phi + phi), guessR); guessR = Rp;
    tt.tube = SC.torqueTube(Rp, R, v('ttm')); tt.L = tt.tube ? tt.tube.lever : 0.35 * WB;
    const rc = SC.frontRC(P), ic = SC.ladderIC(Rp);
    const aL = SC.angles(P.wheel.L, 1), aR = SC.angles(P.wheel.R, -1);
    const cpF = (aL.CP[2] + aR.CP[2]) / 2;
    const cpR = (SC.angles(Rp.wheel.L, 1).CP[2] + SC.angles(Rp.wheel.R, -1).CP[2]) / 2;
    if (rc) hf = rc.z - cpF;
    if (ic) hr = ic.z - cpR;
    const hs = hs0 + zJF + (zJR - zJF) * aS;
    const hra = hf + (hr - hf) * aS;
    const phiN = bisect(q => Mf(q, zJF) + Mr(q, zJR) - Ws * ayB * (hs - hra), -0.35, 0.35);
    dWf = (Wf - Uf) * ayB * hf / TF + Mf(phiN, zJF) / TF + Uf * ayB * RT / TF;
    dWr = (Wr - Ur) * ayB * hr / TR + Mr(phiN, zJR) / TR + Ur * ayB * RT / TR;
    loads = [corner[0] - dWf - dWx / 2, corner[1] + dWf - dWx / 2, corner[2] - dWr + dWx / 2, corner[3] + dWr + dWx / 2];
    // the share of the longitudinal transfer the links carry instead of the bars
    const psN = -(rest.phi + phiN);
    ad = (SC.antiPct(hh => poseF(hh - dzF, psN, steer), 'L', 1, WB, h) +
          SC.antiPct(hh => poseF(hh - dzF, psN, steer), 'R', -1, WB, h)) / 2 * bf / 100;
    asq = (SC.antiPct(hh => poseR(hh - dzR, psN), 'L', 1, WB, h) +
           SC.antiPct(hh => poseR(hh - dzR, psN), 'R', -1, WB, h)) / 2 / 100;
    if (gx < 0) { sF = -dWx * (1 - ad); sR = dWx * (1 - asq * (1 - bf)); }
    else {
      // the axle can only carry the torque the rears can put down: past that they spin
      const capR = [2, 3].reduce((a, i) => a + mu(Math.max(loads[i], 0)) * Math.max(loads[i], 0), 0), FyR = (Wr - Ur) * ayB;
      const Tgrip = Math.sqrt(Math.max(capR * capR - FyR * FyR, 0)) * RT;
      tt.T = Math.min(Teng * gear, Tgrip); tt.spin = Teng * gear > Tgrip; tt.F = tt.T / tt.L;
      sF = -dWx; sR = dWx * (1 - asq) - tt.F;
    }
    sF += (n - 1) * (Fr - Uf); sR += (n - 1) * (W - Fr - Ur);     // the extra load on the banking squats the car
    // front jacking: the track bar is the only lateral path at the front, so its angle
    // turns the front lateral force into a vertical push on the chassis
    const rat = SC.frontRC(P) ? SC.frontRC(P).ratio : 0;
    const Fy = Math.max(0, Wf - Uf) * ayB;
    fj = { Fy, tot: Fy * rat };
    // rear jacking: the ladder triangle is pinned, so the straps' resultant runs from where they cross
    // (the IC) through the pin on the birdcage. Its rise over run turns the rear side force into a push.
    const icR = SC.ladderIC(Rp), pin = Rp.lad.pin, ratR = icR ? (pin[2] - icR.z) / (pin[1] - icR.y) : 0;
    const FyR = Math.max(0, Wr - Ur) * ayB;
    rj = { Fy: FyR, tot: FyR * ratR };
    const zF = bisect(z => force(0, travel(0, phiN, z)) + force(1, travel(1, phiN, z)) + fj.tot - sF, -8, 8);
    const zR = bisect(z => force(2, travel(2, phiN, z)) + force(3, travel(3, phiN, z)) + rj.tot - sR, -8, 8);
    const d = Math.abs(phiN - phi) + Math.abs(zF - zJF) + Math.abs(zR - zJR);
    phi = phiN; zJF += (zF - zJF) * 0.6; zJR += (zR - zJR) * 0.6;
    if (d < 1e-5) break;
  }
  dzF = rest.dzF + zJF; dzR = rest.dzR + zJR;
  // Under throttle: the drive force splits across the rears by load (locked axle, grip-limited), each
  // side's links push its tire down by its drive force x its side-view link slope (anti-squat), and the
  // driveshaft torque twists the housing. Both are moments between the housing and the chassis, so they
  // cannot change the car's total roll moment: they warp it, shared out by the roll stiffness.
  const drive = gx > 0 ? Wt * gx : 0, rr = loads[2] + loads[3] || 1;
  const psR = -(rest.phi + phi), aPct = s => SC.antiPct(hh => poseR(hh - dzR, psR), s, s === 'L' ? 1 : -1, WB, h);
  const anti = { pct: [aPct('L'), aPct('R')] };
  anti.lb = [drive * loads[2] / rr * anti.pct[0] / 100 * h / WB, drive * loads[3] / rr * anti.pct[1] / 100 * h / WB];
  const Tds = tt.T / gear;      // in-lb at the pinion: the engine's torque, or what the rears can take
  // + loads the LR: the pinion climbing the ring gear unloads the RR (standard engine rotation)
  const Mw = Tds + (anti.lb[0] - anti.lb[1]) * TR / 2, kf = Kf / (Kf + Kr);
  const warp = [-Mw / TF * kf, Mw / TF * kf, Mw / TR * kf, -Mw / TR * kf];
  const tq = { T: Tds, lr: Tds / TR * kf, lf: -Tds / TF * kf };
  loads = loads.map((x, i) => x + warp[i]);
  const cap = i => mu(Math.max(loads[i], 0)) * Math.max(loads[i], 0);
  const Fxf = gx < 0 ? Wt * -gx * bf : 0, Fxr = gx < 0 ? Wt * -gx * (1 - bf) : Wt * gx;
  const uf = Math.hypot(Wf * ayB, Fxf) / (cap(0) + cap(1)), ur = Math.hypot(Wr * ayB, Fxr) / (cap(2) + cap(3));
  // bite: what the rear tires have left, on the same friction circle the balance uses
  const capR = cap(2) + cap(3), FyRr = Math.abs(Wr * ayB);
  const bite = { lr: loads[2], fwd: Math.sqrt(Math.max(capR * capR - FyRr * FyRr, 0)) - drive,
                 side: Math.sqrt(Math.max(capR * capR - Fxr * Fxr, 0)) - FyRr, drive };
  const stgNeed = 2 * Math.PI * RT * TR / (v('rad') * 12);
  const a0L = SC.angles(MR.base.f.wheel.L, 1), aNL = SC.angles(P.wheel.L, 1);
  return {
    k, ka, dia, loads, corner, dStatic, phi, lltd: dWf / (dWf + dWr || 1), front: Wf / Wt,
    hf, hr, ay, ayB, n, bank: bk, gx, W: Wt, h: hs0, dzF, dzR, zJF, zJR, rest, P, Rp, fj, rj, anti, tq, tt, warp, bite, Kf, Kr, dWx, ad, asq, bf,
    pitch: Math.atan((zJF - zJR) / WB), bal: (uf - ur) * 100, stg: v('stg') - stgNeed, stgNeed,
    rearSteer: SC.rearSteer(Rp), rollSteer: aNL.toe - a0L.toe,
    rcy: (SC.ladderIC(Rp) || { y: 0 }).y,
    travel: [0, 1, 2, 3].map(i => travel(i, phi, i < 2 ? zJF : zJR)),
  };
}

// ---------------------------------------------------------------- charts
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
const SW = []; for (let q = -3; q <= 3.001; q += 0.25) SW.push(+q.toFixed(2));
let curves = null;

function frontSeries(c, steer, st) {
  let g = null; const out = [];
  for (const hh of SW) {
    const p = SC.poseFront(c, st.h + hh, st.psi, steer, g); g = p;
    out.push({ camL: SC.angles(p.wheel.L, 1, p.kp.L), camR: SC.angles(p.wheel.R, -1, p.kp.R), shift: p.u[1] });
  }
  return out;
}
function recomputeCurves() {
  curves = frontSeries(F, v('k-steer'), { h: -Z.dzF, psi: -Z.phi });
  drawDyn();
}

// ---------------------------------------------------------------- read-outs
const sg = x => (x >= 0 ? '+' : '−') + Math.abs(x);
const f2 = (x, n) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(n == null ? 2 : n);
const TIP = {
  'Camber to ground, °': 'Wheel tilt seen from the front, measured to the track. + = top of tire out. A beam axle holds this through roll.',
  'Camber to chassis, °': 'The same tilt measured against the chassis. This is what changes in roll, and it is what the 3D shows.',
  'Caster, °': 'Kingpin tilt seen from the side, to the ground, so it moves with the rake. + = upper end behind the lower.',
  'KPI, °': 'Kingpin inclination: kingpin tilt seen from the front. + = upper end inboard.',
  'Toe-out, °': 'Wheel steer angle. + = front of tire points out.',
  'Toe-out, in': 'The same angle measured across the tire diameter, which is how you set it. Total toe is the two added together.',
  'Bump steer, °/in': 'Toe change per inch of axle travel here. On this car it comes mostly from the track bar scrubbing the axle sideways while the drag link stays put on the chassis.',
  'Steering ratio, °/°': 'Wheel steer per degree of pitman arm. Moving the drag link further out on the pitman arm lengthens it and slows this down.',
  'Scrub radius, in': 'Distance at the ground from the kingpin line to the tire centre, seen from the front.',
  'Mech. trail, in': 'Distance at the ground from the kingpin line to the tire centre, seen from the side.',
  'Anti-dive, %': 'How much of the braking dive the radius rods resist, at the Setup tab CG height and front brake share. 100% = no dive.',
  'Wheel travel, in': 'Vertical move of this wheel centre against the chassis, from ride height. + = up.',
  'Rear RC height, in': 'Where the two Jacobs ladder straps cross, above the ground.',
  'Rear RC lateral, in': 'Where that crossing point sits across the car. + = left of the centreline. If it runs far outside the car the straps are near parallel, and the height it gives stops meaning much.',
  'Strap angles, °': 'Upper and lower strap rise, from the chassis hole to the ladder. The closer to parallel, the freer the axle is in heave.',
  'Top rod angle, °': 'Side-view rise of the top radius rod, + = the frame end sits higher than the birdcage end. Turning the rod end changes this, which is most of what clocking the cage does.',
  'Bar arm angle, °': 'Side-view rise of the torsion bar arm, + = the bar end higher than the birdcage end.',
  'Bar arm motion ratio': 'Arm-end travel per inch of wheel travel. Wheel rate goes with its square, so clocking the cage changes the effective bar rate as well as the geometry.',
  'Axle side shift, in': 'How far the axle has moved sideways under the body. + = left. A Jacobs ladder holds the axle close to centred through travel, which is the reason to run one instead of a track bar.',
  'Rear steer, °': 'Where the rear axle aims against the chassis centreline. + = aims right (LR ahead of RR), which loosens the car; - = RR ahead, tighter.',
  'Birdcage clocking, °': 'How the cage sits on the axle tube: the angle of the line from the torsion bar arm mount up to the radius rod mount, off vertical in side view. + = the top of the cage leans forward. The CAD already has the cages clocked, and differently side to side.',
  'Torque tube angle, °': 'The torque tube seen from the side, + = rising toward the torque ball.',
  'Rear end pitch, °': 'How far the housing has turned about the axle from where the 3D model draws it, + = nose up. The torque tube sets this: the birdcages turn on the tube, so nothing else does.',
  'Torque tube lever, in': 'Rear axle to the torque ball, measured along the tube.',
  'Torque tube overlap, in': 'How far the two halves of the tube still overlap where they telescope. 7.03 as drawn.',
  'Torsion arm slide, in': 'How far each torsion arm has slid along its bar from where the CAD has it, + = toward the left. The arms are splined to the bars and keep their length; they only slide to stay in line with the birdcage. At rest most of this is the housing being centred.',
  'Birdcage turn from rest, °': 'How far the cage has rolled on the tube from where this setup put it. This is what lets the top rod and the bar arm both work through travel.',
  'Strap holes on the chassis, in': 'Where the upper and lower straps have to bolt on the chassis bracket, up (+) or down (-) from the holes in the CAD, so the straps reach with the housing centred and the clevis where it always is.',
  'Ideal strap holes, in': 'Where the straps would bolt for the housing to sit dead centre, if the bracket had a hole there. The holes used are the nearest real ones, moved by the sliders.',
  'Clevis shift on the RR, in': 'How far the clevis had to move out on the birdcage to let the straps reach. Held to 1/4 in or less; anything that needs more is not a build.',
  'Rear end off centre, in': 'Where the housing centre sits across the car. Held at zero by the ladder mount above.',
  'Ladder triangle swing, °': 'How far the ladder triangle has turned on its pin at the right-rear hub. That pin is what lets the axle heave while both straps keep their length - a ladder bolted solid would have to stretch them.',
  'Wheelbase change, in': 'Fore and aft move of each rear contact patch from ride height. + = longer.',
  'Anti-squat, %': 'How much of the throttle squat the rear links resist, at the Setup tab CG height. 100% = no squat.',
  'Top rod length, in': 'Changes when you turn the rod end (or clock the cage, which is the same thing), or move a mounting hole.',
};
const FTIP = {
  'Bite (LR load)': 'Load on the LR tire right now, lb.',
  'Forward bite': 'Drive force the rear tires can still put down, lb, after the side force they are making: how much more throttle the rear will take. Negative = they are already spinning.',
  'Side bite': 'Side force the rear tires can still make, lb, after the drive force they are putting down. Negative = the rear is sliding.',
  'Rear jacking': 'Vertical force from the Jacobs ladder on the chassis, from the rear side force along the line from where the straps cross to the pin on the birdcage. + = pulls the rear down, - = pushes it up.',
  'Front jacking': 'Vertical force from the track bar on the chassis, plus the radius rods under braking. + = pulls the front down, - = pushes it up.',
  'Anti-squat LR / RR': 'Vertical force each side’s links put into its tire from the drive force: drive on that tire x its side-view link slope. + = pushes the tire down. Only under throttle.',
  'Anti-squat %, LR / RR': 'Share of the throttle squat the rear links resist on each side, at the CG height set above.',
  'Torque tube lift at mount': 'Engine torque x gear ratio, divided by the distance from the rear axle to the torque ball along the tube. Pushes up on the engine plate and down on the housing, so the rear springs carry this much less and the rear rises. On throttle only, and capped at the torque the rear tires can put down - past that they spin.',
  'Torque tube lever': 'Rear axle to the torque ball, measured along the tube, at this moment. The lift at the mount is the axle torque divided by this.',
  'Torque reaction LR / RF': 'Driveshaft torque twisting the rear housing: it unloads the RR and loads the LR, and the chassis passes part of it to the front, loading the RF. lb on the LR and the RF; the RR and LF lose the same.',
};
const tipFor = n => TIP[n] || TIP[n.replace(/^[LR]R /, '').replace(/^./, c => c.toUpperCase())] || '';
const tipRow = (n, cells, chg) => '<tr><td><abbr title="' + tipFor(n) + '">' + n + '</abbr></td>' +
  cells.map(c => '<td' + (chg ? ' class="chg"' : '') + '>' + c + '</td>').join('') + '</tr>';

function frontTable(P, rollDeg, pitchDeg) {
  const A = { L: SC.angles(P.wheel.L, 1, P.kp.L), R: SC.angles(P.wheel.R, -1, P.kp.R) };
  const toGround = { L: A.L.camber - rollDeg, R: A.R.camber + rollDeg };
  const hcg = v('cg'), bf = v('bb') / 100, steer = v('k-steer');
  const i1 = SW.indexOf(1), i2 = SW.indexOf(-1);
  const bs = s => (curves[i1]['cam' + s].toe - curves[i2]['cam' + s].toe) / 2;
  // wheel steer per degree of pitman arm, measured off the linkage
  const dsteer = {};
  { const d = 2, a = SC.poseFrontRaw(F, P.h, P.psi, SC.pitmanFor(F, steer) + d),
          b = SC.poseFrontRaw(F, P.h, P.psi, SC.pitmanFor(F, steer) - d);
    for (const sd of ['L', 'R'])
      dsteer[sd] = Math.abs(SC.angles(a.wheel[sd], sd === 'L' ? 1 : -1).toe -
                            SC.angles(b.wheel[sd], sd === 'L' ? 1 : -1).toe) / (2 * d); }
  const adv = s => SC.antiPct(hh => SC.poseFront(F, P.h + hh, P.psi, steer), s, s === 'L' ? 1 : -1, WB, hcg) * bf;
  const rows = [
    ['Camber to ground, °', s => toGround[s].toFixed(2)],
    ['Camber to chassis, °', s => A[s].camber.toFixed(2)],
    ['Caster, °', s => (A[s].caster - pitchDeg).toFixed(2)],
    ['KPI, °', s => A[s].kpi.toFixed(2)],
    ['Toe-out, °', s => A[s].toe.toFixed(3)],
    ['Toe-out, in', s => (Math.tan(A[s].toe / DEG) * 2 * P.wheel[s].r).toFixed(3)],
    ['Bump steer, °/in', s => bs(s).toFixed(3)],
    ['Steering ratio, °/°', s => (dsteer[s] || 0).toFixed(2)],
    ['Scrub radius, in', s => A[s].scrub.toFixed(2)],
    ['Mech. trail, in', s => A[s].trail.toFixed(2)],
    ['Anti-dive, %', s => adv(s).toFixed(1)],
    ['Wheel travel, in', s => f2(P.wheel[s].c[2] - MR.base.f.wheel[s].c[2])],
  ];
  $('kf-tab').innerHTML = rows.map(([n, f]) => tipRow(n, [f('L'), f('R')])).join('');
  $('k-lfc').textContent = toGround.L.toFixed(2) + '°';
  $('k-rfc').textContent = toGround.R.toFixed(2) + '°';
  const rc = SC.frontRC(P);
  const cp = (A.L.CP[2] + A.R.CP[2]) / 2;
  $('k-rch').textContent = rc ? (rc.z - cp).toFixed(2) + ' in' : '—';
  $('k-shift').textContent = f2(P.u[1], 3) + ' in';
  $('k-bs').textContent = bs('L').toFixed(3) + '°/in';
  // parts whose length moved when a hole moved
  const b = SC.buildFront(HP, {});
  const rows2 = F.links.map((l, i) => {
    const d = l.L - b.links[i].L;
    const nm = { RU: 'RF upper rod', RL: 'RF lower rod', LL: 'LF lower rod', TB: 'Track bar' }[l.name] + ', in';
    return '<tr><td>' + nm + '</td><td' + (Math.abs(d) > 5e-4 ? ' class="chg"' : '') + '>' +
      l.L.toFixed(3) + (Math.abs(d) > 5e-4 ? ' (' + f2(d, 3) + ')' : '') + '</td></tr>';
  });
  for (const [nm, cur, bas] of [['Drag link, in', F.Ldrag, b.Ldrag], ['Tie rod, in', F.Ltie, b.Ltie]]) {
    const d = cur - bas;
    rows2.push('<tr><td>' + nm + '</td><td' + (Math.abs(d) > 5e-4 ? ' class="chg"' : '') + '>' +
      cur.toFixed(3) + (Math.abs(d) > 5e-4 ? ' (' + f2(d, 3) + ')' : '') + '</td></tr>');
  }
  $('kf-parts').innerHTML = rows2.join('');
  return { A, rc, toGround };
}

function rearTable(Rp, rollDeg) {
  const ic = SC.ladderIC(Rp), hcg = v('cg'), tube = SC.torqueTube(Rp, R, v('ttm'));
  const cp = (SC.angles(Rp.wheel.L, 1).CP[2] + SC.angles(Rp.wheel.R, -1).CP[2]) / 2;
  const asq = s => SC.antiPct(hh => SC.poseRear(R, Rp.h + hh, Rp.psi), s, s === 'L' ? 1 : -1, WB, hcg);
  const wbc = s => -(SC.angles(Rp.wheel[s], s === 'L' ? 1 : -1).CP[0] - SC.angles(MR.base.r.wheel[s], s === 'L' ? 1 : -1).CP[0]);
  // link angle in side view, + = the chassis end sits higher than the axle end
  const ang = (a, c) => Math.atan2(c[2] - a[2], Math.abs(c[0] - a[0])) * DEG;
  const b = SC.buildRear(HP, {});
  const per = f => [0, 1].map(i => f(Rp.cage[i], i)).join(' / ');
  const far = ic && Math.abs(ic.y) > 40;
  const rows = [
    ['Rear RC height, in', [(ic ? (ic.z - cp).toFixed(2) : '—') + (far ? ' (see below)' : '')]],
    ['Rear RC lateral, in', [ic ? f2(ic.y, far ? 0 : 2) : '—']],
    ['Strap angles, °', [ic ? f2(ic.angUp, 1) + ' / ' + f2(ic.angLo, 1) : '—']],
    ['Axle side shift, in', [f2(Rp.u[1], 3)]],
    ['Rear steer, °', [f2(SC.rearSteer(Rp), 3)]],
    ['Birdcage clocking, °', [per(g => f2(g.clock, 2))]],
    ['Birdcage turn from rest, °', [per(g => f2(g.ang, 2))]],
    ['Torsion arm slide, in', [per(g => f2(g.slide, 3))]],
    ['Ladder triangle swing, °', [f2(Rp.triAng, 2)]],
    ['Strap holes on the chassis, in', [f2(R.lad.holeMove[0], 2) + ' / ' + f2(R.lad.holeMove[1], 2)]],
    ['Ideal strap holes, in', [f2(R.lad.idealMove[0], 2) + ' / ' + f2(R.lad.idealMove[1], 2)]],
    ['Clevis shift on the RR, in', [f2(R.lad.mount, 3)]],
    ['Rear end off centre, in', [f2(R.housingCentre + Rp.u[1], 3)]],
    ...(tube ? [['Torque tube angle, °', [f2(tube.angle, 2)]], ['Rear end pitch, °', [f2(tube.pitch, 2)]],
      ['Torque tube lever, in', [tube.lever.toFixed(2)]], ['Torque tube overlap, in', [tube.overlap.toFixed(2) + (tube.overlap < 2 ? ' (short)' : '')]]] : []),
    ['Top rod angle, °', [per(g => f2(ang(g.rodA, g.rodC), 1))]],
    ['Bar arm angle, °', [per(g => f2(ang(g.barArm, g.barPivot), 1))]],
    ['Bar arm motion ratio', [['L', 'R'].map(s => MR.arm[s + 'R'].toFixed(3)).join(' / ')]],
    ['Wheelbase change, in', [f2(wbc('L'), 3) + ' / ' + f2(wbc('R'), 3)]],
    ['Anti-squat, %', [asq('L').toFixed(1) + ' / ' + asq('R').toFixed(1)]],
  ];
  R.cage.forEach((g, i) => {
    for (const [lab, cur, bas] of [['top rod', g.Lrod, b.cage[i].Lrod]]) {
      const d = cur - bas;
      rows.push([g.side + 'R ' + lab + ' length, in',
        [cur.toFixed(3) + (Math.abs(d) > 5e-4 ? ' (' + f2(d, 3) + ')' : '')]]);
    }
  });
  $('kr-tab').innerHTML = rows.map(([n, c]) => tipRow(n, c)).join('');
  $('q-rc').textContent = ic ? (ic.z - cp).toFixed(2) + ' in' : '—';
  $('q-rcy').textContent = ic ? f2(ic.y) + ' in' : '—';
  $('q-rst').textContent = f2(SC.rearSteer(Rp), 3) + '°';
  $('q-asq').textContent = asq('L').toFixed(0) + ' / ' + asq('R').toFixed(0) + '%';
  $('q-cage').textContent = f2(Rp.cage[0].clock, 1) + ' / ' + f2(Rp.cage[1].clock, 1);
  {
    const L = R.lad, off = R.housingCentre + Rp.u[1], mv = L.holeMove;
    $('lad-note').textContent = L.shift > 1e-4 ? 'Straps ' + L.shift.toFixed(2) + ' in short centred, so the rear end moves ' +
      L.shift.toFixed(2) + ' in right. Put the wheels back with LR out ' + f2(L.shift, 2) + ' / RR out ' + f2(-L.shift, 2) + '.' : '';
    $('track-note').textContent = 'Rear track ' + R.track.toFixed(2) + ' in, wheels at ' +
      f2(R.wheel.L.c[1] + Rp.u[1], 2) + ' / ' + f2(R.wheel.R.c[1] + Rp.u[1], 2) +
      ' in either side of the centreline.';
  }
  $('kr-note').textContent = far
    ? 'Straps nearly parallel: read the rear RC height as a trend.'
    : '';
}

// ---------------------------------------------------------------- setup read-outs
const OUTROWS = [['Body roll, °', 'roll', 2], ['Front LLTD, %', 'lltd', 1], ['Cross, %', 'cross', 1],
  ['LF load, lb', 'LF', 0], ['RF load, lb', 'RF', 0], ['LR load, lb', 'LR', 0], ['RR load, lb', 'RR', 0],
  ['Front RC, in', 'fRC', 2], ['Rear RC, in', 'rRC', 2], ['Front jacking, lb', 'fjd', 0], ['Rear jacking, lb', 'rjd', 0],
  ['Forward bite, lb', 'fwd', 0], ['Side bite, lb', 'side', 0],
  ['Rear steer, °', 'rst', 2], ['Front roll steer, °', 'frs', 2], ['Balance', 'bal', 1], ['Stagger vs corner, in', 'stg', 2]];
function outSummary() {
  const m = model;
  return { roll: m.phi * DEG, lltd: m.lltd * 100, cross: (m.loads[2] + m.loads[1]) / m.W * 100,
    LF: m.loads[0], RF: m.loads[1], LR: m.loads[2], RR: m.loads[3], fRC: m.hf, rRC: m.hr,
    fjd: -m.fj.tot, rjd: -m.rj.tot, fwd: m.bite.fwd, side: m.bite.side, rst: m.rearSteer, frs: m.rollSteer, bal: m.bal, stg: m.stg };
}
const RANGES = ['g', 'gx', 'bank', 'rad', 'stg', 'wing', 'fwing', 'blen', 'unf', 'unr', 'bb', 'dlf', 'drf', 'dlr', 'drr',
  'cg', 'ls', 'rp', 'cr'];
const DP3 = ['dlf', 'drf', 'dlr', 'drr'], DP2 = ['g', 'gx', 'stg', 'cg', 'blen'];
function update() {
  for (const id of RANGES) {
    const q = v(id);
    $(id + '-o').textContent = DP3.includes(id) ? q.toFixed(3) : ['ls', 'rp', 'cr'].includes(id) ? q.toFixed(1) + '%'
      : DP2.includes(id) ? q.toFixed(2) : q.toLocaleString('en-US');
  }
  for (const id of ['wingp', 'fwingp', 'wingh', 'fwingh']) $(id + '-o').textContent = f2(v(id), 2);
  model = calc();
  const m = model;
  $('scale-leg').textContent = 'Scales, ' + (+v('wt')).toLocaleString() + ' lb';
  $('roll').textContent = (m.phi * DEG).toFixed(2) + '°';
  const turning = m.ay >= 0.05;
  $('bank-note').textContent = m.bank > 0 ? 'On this banking the tires feel ' + m.ayB.toFixed(2) + ' g sideways and carry ' +
    m.n.toFixed(2) + "× the car's weight." : '';
  world.rotation.x = -m.bank;      // right side up
  $('lltd').textContent = turning ? (m.lltd * 100).toFixed(1) + '%' : '—';
  $('rc-s').textContent = m.hf.toFixed(2) + ' in';
  $('rrc-s').textContent = m.hr.toFixed(2) + ' in';
  const fjl = m.gx < 0 ? -m.dWx * m.ad : 0;
  $('fjk-s').textContent = f2(-(m.fj.tot + fjl), 0) + ' lb';
  {
    const lb = x => Math.round(x).toLocaleString('en-US'), s0 = x => f2(x, 0);
    const rows = [['Bite (LR load)', lb(m.bite.lr)],
      ['Forward bite', s0(m.bite.fwd)], ['Side bite', s0(m.bite.side)],
      ['Rear jacking', s0(-m.rj.tot)], ['Front jacking', s0(-(m.fj.tot + fjl))],
      ['Anti-squat LR / RR', s0(m.anti.lb[0]) + ' / ' + s0(m.anti.lb[1])],
      ['Anti-squat %, LR / RR', m.anti.pct[0].toFixed(0) + ' / ' + m.anti.pct[1].toFixed(0)],
      ['Torque reaction LR / RF', s0(m.tq.lr) + ' / ' + s0(-m.tq.lf)],
      ['Torque tube lift at mount', s0(m.tt.F) + (m.tt.spin ? ' (tires spin)' : '')],
      ['Torque tube lever', m.tt.L.toFixed(2)]];
    $('force-tab').querySelector('tbody').innerHTML = rows.map(([n, x]) =>
      '<tr><td><abbr title="' + (FTIP[n] || '') + '">' + n + (n.includes('%') ? '' : n.includes('lever') ? ', in' : ', lb') + '</abbr></td><td>' + x + '</td></tr>').join('');
    $('force-note').textContent = m.bite.drive > 0 ? 'Putting down ' + lb(m.bite.drive) + ' lb of drive (Long g x weight).'
      : 'Off throttle: forward bite is all the drive the rears could take.';
  }
  $('ride-s').textContent = f2(m.zJF) + ' / ' + f2(m.zJR);
  $('hlr-o').textContent = Z.lr.toFixed(3);
  ['rnlf', 'rnrf', 'rnlr', 'rnrr'].forEach((id, i) => $(id + '-o').textContent = f2(m.rest.rnd[i], 3));
  $('rh-now').innerHTML = '<tr><td>Ride ht now</td>' + m.rest.hNow.map(q => '<td>' + q.toFixed(3) + '</td>').join('') + '</tr>';
  $('pitch-s').textContent = f2(m.pitch * DEG) + '°';
  $('rst-s').textContent = f2(m.rearSteer, 2) + '°';
  $('frs-s').textContent = f2(m.rollSteer, 2) + '°';
  $('bal-s').textContent = !turning ? '—' : f2(m.bal, 1) + (Math.abs(m.bal) < 1 ? ' neutral' : m.bal > 0 ? ' tight' : ' loose');
  $('stg-s').textContent = f2(m.stg) + ' in';
  $('rate-tab').querySelector('tbody').innerHTML =
    '<tr><td>At the bar arm</td>' + ['LF', 'RF', 'LR', 'RR'].map(c => '<td>' + Math.round(m.ka[c]) + '</td>').join('') + '</tr>' +
    '<tr><td>At the wheel</td>' + ['LF', 'RF', 'LR', 'RR'].map(c => '<td>' + Math.round(m.k[c]) + '</td>').join('') + '</tr>';
  $('mr-note').textContent = 'Motion ratios from the linkage: bar arm ' +
    ['LF', 'RF', 'LR', 'RR'].map(c => c + ' ' + MR.arm[c].toFixed(3)).join(' · ') +
    '; shock ' + ['LF', 'RF', 'LR', 'RR'].map(c => c + ' ' + MR.shock[c].toFixed(2)).join(' · ') + '.';
  {
    const d = m.dStatic, big = d.some(x => Math.abs(x) >= 0.5);
    $('pre-note').textContent = big ? 'Rounds change the scaled weights: LF ' + f2(d[0], 0) + ', RF ' + f2(d[1], 0) +
      ', LR ' + f2(d[2], 0) + ', RR ' + f2(d[3], 0) + ' lb. Cross is now ' +
      ((m.corner[1] + m.corner[2]) / (m.corner[0] + m.corner[1] + m.corner[2] + m.corner[3]) * 100).toFixed(1) + '%.' : '';
    $('wdg-note').textContent = 'Roll stiffness, in-lb/°: front ' + Math.round(m.Kf / DEG).toLocaleString('en-US') +
      ' · rear ' + Math.round(m.Kr / DEG).toLocaleString('en-US') +
      ' (' + Math.round(m.Kr / (m.Kf + m.Kr) * 100) + '% rear). No sway bars on this car.';
  }
  compareTable();
  m.loads.forEach((w, i) => {
    const r = Math.sqrt(Math.max(w, 0)) * 0.6; discs[i].scale.set(r, r, 1);
    const t = Math.min(Math.max(w / (m.W * 0.45), 0), 1);
    discs[i].material.color.setHSL(0.6 - 0.6 * t, 0.75, 0.5);
    tags[i].innerHTML = '<i>' + ['LF', 'RF', 'LR', 'RR'][i] + '</i>' + (w < 0 ? '0 lb · lifted' : Math.round(w) + ' lb');
  });
  {
    const n = ['LF', 'RF', 'LR', 'RR'], msg = [];
    const lift = n.filter((x, i) => m.loads[i] < 0), far = n.filter((x, i) => Math.abs(m.travel[i]) > 3.5);
    if (lift.length) msg.push(lift.join(' and ') + ' lifted off the ground. This model does not move the extra load to the other tires, so the numbers past this point are not real.');
    if (far.length) msg.push(far.join(', ') + ' travel is past ±3.5 in, beyond the modeled range.');
    if (Math.abs(m.rcy) > 40) msg.push('The ladder straps are nearly parallel, so they cross ' + Math.abs(m.rcy).toFixed(0) + ' in outside the car. The rear roll centre height that gives is very sensitive to the strap angles - treat it as a trend.');
    $('warn').hidden = !msg.length; $('warn').textContent = msg.join(' ');
  }
  axisLine.geometry.setFromPoints([new THREE.Vector3(TIRE[0][0] + 10, 0, m.hf), new THREE.Vector3(TIRE[2][0] - 10, 0, m.hr)]);
  cgDot.position.set(TIRE[0][0] - WB * (1 - m.front), 0, m.h);
  const won = $('winged').checked; wingDot.visible = fwingDot.visible = won; $('wing-rows').hidden = !won;
  for (const o of (G.sprungWing || []).concat(G.sprungFwing || [])) o.visible = won;
}

// ---------------------------------------------------------------- tabs
let tab = 'setup', sel = 'front';
const camMem = {}, CAMDEF = { setup: [[170, -150, 100], [0, 0, 14]], dyn: [[290, -250, 150], [0, 0, 14]], front: [[175, -115, 62], [26, 0, 14]], rear: [[-175, -115, 58], [-28, 0, 16]] };
const camKey = () => 'setup';      // one camera for every tab
const saveCam = () => { camMem[camKey()] = { p: cam.position.toArray(), t: controls.target.toArray() }; };
const restoreCam = () => { const m = camMem[camKey()]; if (m) view(m.p, m.t); else view(CAMDEF[camKey()][0], CAMDEF[camKey()][1]); };
function applyTab(t) {
  tab = t; lastKey = '';
  for (const k of ['setup', 'kin', 'dyn']) { $('t-' + k).setAttribute('aria-selected', t === k); $('p-' + k).hidden = t !== k; }
  $('stats-setup').hidden = t !== 'setup';
  // Dynamics gives the charts half the screen
  document.querySelector('.wrap').classList.toggle('dyn', t === 'dyn');
  $('stats-kf').hidden = !(t === 'kin' && sel === 'front');
  $('stats-kr').hidden = !(t === 'kin' && sel === 'rear');
  discs.forEach(d => d.visible = true); tags.forEach(x => x.style.visibility = 'visible');   // loads show on every tab
  axisLine.visible = cgDot.visible = t === 'setup';
  $('leg-axis').textContent = t === 'setup' ? 'Roll axis' : 'Instant centres';
  $('sub').textContent = t === 'setup' ? 'steady-state corner' : t === 'dyn' ? 'heave, roll and pitch'
    : sel === 'front' ? 'front beam axle · radius rods, track bar, drag link' : 'rear axle · radius rods and Jacobs ladder';
  restoreCam();
}
// saveCam has to run against the key we are LEAVING, so the end switch does its own save
function setTab(t) { saveCam(); applyTab(t); }
$('t-setup').onclick = () => setTab('setup');
$('t-kin').onclick = () => { stopDrive(); setTab('kin'); };
$('t-dyn').onclick = () => { stopDrive(); setTab('dyn'); };
function setEnd(s) {
  saveCam(); sel = s;
  $('c-front').setAttribute('aria-pressed', s === 'front'); $('c-rear').setAttribute('aria-pressed', s === 'rear');
  $('k-front').hidden = $('k-front-out').hidden = s !== 'front';
  $('k-rear').hidden = $('k-rear-out').hidden = s !== 'rear';
  applyTab('kin');
}
$('c-front').onclick = () => setEnd('front');
$('c-rear').onclick = () => setEnd('rear');

// ---------------------------------------------------------------- kinematics controls
const FCTL = [['k-ru-c', 'rodCz', 0], ['k-ru-a', 'rodAz', 0], ['k-rl-c', 'rodCz', 1], ['k-rl-a', 'rodAz', 1],
  ['k-ll-c', 'rodCz', 2], ['k-ll-a', 'rodAz', 2], ['k-ru-x', 'rodCx', 0], ['k-rl-x', 'rodCx', 1], ['k-ll-x', 'rodCx', 2], ['k-tb-a', 'tbA'], ['k-tb-c', 'tbC'],
  ['k-drag', 'drag'], ['k-tieL', 'tieL'], ['k-tieR', 'tieR'],
  ['k-dragl', 'dragLen'], ['k-tiel', 'tieLen'], ['k-phole', 'pitmanHole'],
  ['k-cas-l', 'caster', 0], ['k-cas-r', 'caster', 1], ['k-cam-l', 'camber', 0], ['k-cam-r', 'camber', 1]];
const RCTL = [['r-wl', 'wheelL'], ['r-wr', 'wheelR'], ['r-hu', 'holeUpN'], ['r-hl', 'holeLoN'],
  ['r-lt-c', 'rodCz', 0], ['r-lt-a', 'rodAz', 0], ['r-rt-c', 'rodCz', 1], ['r-rt-a', 'rodAz', 1],
  ['r-lt-l', 'rodLen', 0], ['r-rt-l', 'rodLen', 1], ['r-lt-x', 'rodCx', 0], ['r-rt-x', 'rodCx', 1]];
// the ladder parts are picked from a list, not slid
const RSEL = [['r-lad', 'ladderRun'], ['r-strap', 'strap'], ['r-clev', 'clevis'], ['r-pitch', 'holePitch']];
const KOUT = [...FCTL.map(c => c[0]), ...RCTL.map(c => c[0]), 'k-steer', 'k-heave', 'k-roll'];
const kOutputs = () => KOUT.forEach(id => {
  // whole holes show as whole numbers, angles to a tenth, everything else in thousandths
  const q = v(id), dp = /^r-h[ul]$/.test(id) ? 0
    : id === 'k-steer' || /^r-clk-|^k-cas-|^k-cam-/.test(id) ? 1
    : id === 'k-heave' || id === 'k-roll' ? 2 : 3;
  $(id + '-o').textContent = (q >= 0 ? '+' : '−') + Math.abs(q).toFixed(dp);
});

function rebuild() { buildAll(); recomputeCurves(); update(); poseNotes(); lastKey = ''; if (typeof setClockSliders === 'function' && $('r-clk-l')) setClockSliders(); }
for (const [id, key, i] of FCTL) $(id).addEventListener('input', () => {
  const q = v(id);
  if ((id === 'k-tb-a' || id === 'k-tb-c') && $('k-tbtog').checked) { fadj.tbA = fadj.tbC = q; $('k-tb-a').value = $('k-tb-c').value = q; }
  else if (i == null) fadj[key] = q; else fadj[key][i] = q;
  kOutputs(); rebuild();
});
for (const [id, key, i] of RCTL) $(id).addEventListener('input', () => {
  const q = v(id);
  if (i == null) radj[key] = q; else radj[key][i] = q;
  kOutputs(); rebuild();
});
for (const [id, key] of RSEL) $(id).addEventListener('change', () => { radj[key] = +$(id).value; rebuild(); });
// match on the number, not the string: an option written "12.80" is not String(12.80)
const setRearSelects = () => RSEL.forEach(([id, key]) => {
  const o = [...$(id).options].find(op => Math.abs(+op.value - radj[key]) < 1e-9);
  if (o) $(id).value = o.value;
});
// Clocking is not set on its own: with the torsion arm a fixed length, the cage turns to
// wherever the top rod puts it. So the clocking slider solves the rod length that gives
// the clocking asked for, and both sliders always show the car as it is.
const setClockSliders = () => {
  const p = poseR(-Z.dzR, -Z.phi);
  ['l', 'r'].forEach((sd, i) => { $('r-clk-' + sd).value = p.cage[i].clock.toFixed(1); });
  ['r-lt-l', 'r-rt-l'].forEach((id, i) => { $(id).value = radj.rodLen[i]; });
  kOutputs();
};
function clockTo(i, target) {
  const at = len => {
    const t = SC.buildRear(HP, Object.assign({}, radj, { rodLen: i ? [radj.rodLen[0], len] : [len, radj.rodLen[1]] }));
    return SC.poseRear(t, -Z.dzR, S.psiR - Z.phi).cage[i].clock - target;
  };
  // clocking falls about 8 deg per inch of rod, so start the secant from there
  const len = SC.solve1(at, radj.rodLen[i] - (target - poseR(-Z.dzR, -Z.phi).cage[i].clock) / 8, 0.05);
  radj.rodLen[i] = Math.max(-3, Math.min(3, len));
}
['l', 'r'].forEach((sd, i) => $('r-clk-' + sd).addEventListener('input', () => {
  clockTo(i, v('r-clk-' + sd)); rebuild(); setClockSliders();
}));
$('k-steer').addEventListener('input', () => { kOutputs(); recomputeCurves(); update(); lastKey = ''; });
['k-heave', 'k-roll'].forEach(id => $(id).addEventListener('input', () => { kOutputs(); sweeping = false; $('k-sweep').textContent = 'Sweep bump and droop'; }));
let sweeping = false, sweepT = 0;
$('k-sweep').onclick = () => { sweeping = !sweeping; sweepT = 0; $('k-sweep').textContent = sweeping ? 'Stop sweep' : 'Sweep bump and droop'; };
$('k-zero').onclick = () => { sweeping = false; $('k-sweep').textContent = 'Sweep bump and droop'; $('k-heave').value = 0; $('k-roll').value = 0; kOutputs(); };
$('k-reset').onclick = () => {
  if (sel === 'front') { fadj = JSON.parse(JSON.stringify(FADJ0)); FCTL.forEach(([id]) => $(id).value = 0); $('k-steer').value = 0; }
  else { radj = JSON.parse(JSON.stringify(RADJ0)); RCTL.forEach(([id]) => $(id).value = 0); setRearSelects(); setClockSliders(); }
  kOutputs(); rebuild();
};

// ---------------------------------------------------------------- drive the corner
// ponytail: braking -0.6 g and throttle +0.5 g are fixed; make them inputs to tune entry and exit
const DRIVE = [[0, 0, 0.3], [1.2, 0, 0.3], [1.6, 0.05, -0.6], [2.6, 0.5, -0.45], [3.4, 1, -0.1], [4.6, 1, 0], [5.4, 0.9, 0.35], [6.6, 0.35, 0.5], [7.4, 0, 0.3], [8.4, 0, 0.3]];
const PHASES = [[1.2, 'Straight'], [2.6, 'Braking'], [3.4, 'Turn-in, trail brake'], [4.6, 'Mid-corner'], [6.6, 'Throttle, exit'], [9, 'Straight']];
let driving = false, driveT = 0, driveKeep = null;
function driveStep(dt) {
  driveT = (driveT + dt) % DRIVE[DRIVE.length - 1][0];
  let i = 0; while (DRIVE[i + 1][0] < driveT) i++;
  const [t0, a0, x0] = DRIVE[i], [t1, a1, x1] = DRIVE[i + 1], u = (driveT - t0) / (t1 - t0), e = u * u * (3 - 2 * u);
  $('g').value = ((a0 + (a1 - a0) * e) * driveKeep.g).toFixed(2);
  $('gx').value = (x0 + (x1 - x0) * e).toFixed(2);
  const ph = PHASES.find(p => driveT < p[0])[1];
  $('drive-phase').textContent = ph; $('sub').textContent = ph.toLowerCase();
  update();
}
function stopDrive() {
  if (!driving) return;
  driving = false; $('g').value = driveKeep.g; $('gx').value = driveKeep.gx;
  $('drive').textContent = '▶ Drive the corner'; $('drive-phase').textContent = '';
  if (tab === 'setup') $('sub').textContent = 'steady-state corner';
  update();
}
$('drive').onclick = () => { if (driving) { stopDrive(); return; } driveKeep = { g: v('g'), gx: v('gx') }; driving = true; driveT = 0; $('drive').textContent = '■ Stop'; };
['g', 'gx'].forEach(id => $(id).addEventListener('pointerdown', stopDrive));

// ---------------------------------------------------------------- animation
const B = new THREE.Matrix4(), MM = new THREE.Matrix4(), PM = new THREE.Matrix4();
const T1 = new THREE.Matrix4(), RMAT = new THREE.Matrix4(), T2 = new THREE.Matrix4();
const pA = new THREE.Vector3(), pB = new THREE.Vector3(), dirV = new THREE.Vector3(), tmpV = new THREE.Vector3();
function bodyMatrix(out, ang, zF, zR) {
  // roll about the roll axis between the two roll centres, then pitch to sit zF / zR high
  const ax = model;
  pA.set(TIRE[0][0], 0, ax ? ax.hf : 6); pB.set(TIRE[2][0], 0, ax ? ax.hr : 18);
  dirV.subVectors(pA, pB).normalize();
  T1.makeTranslation(-pB.x, -pB.y, -pB.z); RMAT.makeRotationAxis(dirV, ang); T2.makeTranslation(pB.x, pB.y, pB.z + zR);
  out.copy(T2).multiply(RMAT).multiply(T1);
  const th = Math.atan2(zF - zR, TIRE[0][0] - TIRE[2][0]);
  PM.makeTranslation(TIRE[2][0], 0, 0).multiply(new THREE.Matrix4().makeRotationY(-th)).multiply(new THREE.Matrix4().makeTranslation(-TIRE[2][0], 0, 0));
  out.premultiply(PM);
}
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastKey = '', shownRoll = 0, shownF = 0, shownR = 0, exag = false, loaded = false;
$('v-exag').onclick = () => { exag = !exag; $('v-exag').setAttribute('aria-pressed', exag); lastKey = ''; };

const I = new THREE.Matrix4();
// Shocks: in the CAD export each body runs through its top eye and each shaft through its lower eye, but
// the two are not quite in line (0.6-0.8 deg apart, the RR body 3.6 deg off its eye-to-eye line). So each
// part's own axis is found from its mesh once (principal direction of its vertices, raw CAD frame) and
// aimed down the posed eye-to-eye line from its own eye: body and shaft end up on one line, coaxial.
let SHAX = null;
function shockAxes() {
  carRoot.updateMatrixWorld(true);
  const out = {}, v = new THREE.Vector3(), M = new THREE.Matrix4(), inv = new THREE.Matrix4();
  for (const name of Object.keys(G).filter(n => /^[fr]shk[LR][br]$/.test(n))) {
    const pts = [];
    for (const o of G[name]) {
      inv.copy(o.matrixWorld).invert();
      o.traverse(m => { if (!m.isMesh) return; M.multiplyMatrices(inv, m.matrixWorld); const p = m.geometry.attributes.position;
        for (let i = 0; i < p.count; i += 3) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(M).toArray()); });
    }
    const c = [0, 0, 0]; for (const p of pts) for (let a = 0; a < 3; a++) c[a] += p[a] / pts.length;
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (p[a] - c[a]) * (p[b] - c[b]);
    let u = [0.3, 0.2, 1];
    for (let k = 0; k < 80; k++) { const w = [0, 1, 2].map(a => C[a][0] * u[0] + C[a][1] * u[1] + C[a][2] * u[2]); u = V.norm(w); }
    out[name] = u;
  }
  return out;
}
// a0 is the part's own eye (it sits on the part's axis); the part's axis goes onto the line a1 -> b1
function shockSeg(name, a0, b0, a1, b1, outM) {
  SHAX = SHAX || shockAxes();
  let u = SHAX[name]; if (!u) return seg(a0, b0, a1, b1, outM);
  if (V.dot(u, V.sub(b0, a0)) < 0) u = V.mul(u, -1);
  seg(a0, V.add(a0, V.mul(u, V.dist(a0, b0))), a1, b1, outM);
}
function place(P, Rp, Bm) {
  const f = HP.front, r = HP.rear;
  setGroup('sprung', Bm);
  // the wings ride on the body and slide with their position sliders
  setGroupB('sprungWing', Bm, MM.makeTranslation(v('wingp'), 0, v('wingh'))); setGroupB('sprungFwing', Bm, MM.makeTranslation(v('fwingp'), 0, v('fwingh')));
  wingDot.position.set(wingX(), WING_CP[1], WING_CP[2] + v('wingh')).applyMatrix4(Bm); fwingDot.position.set(fwingX(), FWING_CP[1], FWING_CP[2] + v('fwingh')).applyMatrix4(Bm);
  // pitman arm swings about its lateral axis on the chassis
  const pit = SC.pitmanFor(F, v('k-steer'));
  seg(f.steer.box, f.steer.pitman, f.steer.box, P.drag.i, MM); setGroupB('pitman', Bm, MM);
  // front axle, then each knuckle on its kingpin
  affine(f.kingpin.L.p, f.kingpin.R.p, f.trackBar.axle,
         P.T(f.kingpin.L.p), P.T(f.kingpin.R.p), P.T(f.trackBar.axle), MM);
  setGroupB('faxle', Bm, MM);
  for (const s of ['L', 'R']) {
    const th = s === 'L' ? P.thL : P.thR, kp = P.kp[s];
    const sp = q => SC.rot(P.T(q), kp.p, kp.dir, th);
    // from where the meshes are, to where this setup's caster and camber put them
    const p0 = f.kingpin[s].p, p1 = V.add(p0, V.mul(f.kingpin[s].dir, 6)), p2 = f.wheel[s].c;
    const q = F.knuckleRef[s];
    affine(p0, p1, p2, sp(q[0]), sp(q[1]), sp(q[2]), MM); setGroupB('fkn' + s, Bm, MM);
    shockSeg('fshk' + s + 'b', f.shock[s].chassis, f.shock[s].axle, P.shock[s].chassis, P.shock[s].axle, MM); setGroupB('fshk' + s + 'b', Bm, MM);
    shockSeg('fshk' + s + 'r', f.shock[s].axle, f.shock[s].chassis, P.shock[s].axle, P.shock[s].chassis, MM); setGroupB('fshk' + s + 'r', Bm, MM);
    seg(f.bar[s].pivot, f.bar[s].arm, P.bar[s].pivot, P.bar[s].arm, MM); setGroupB('fbar' + s, Bm, MM);
  }
  f.rods.forEach((rod, i) => { stretch(rod.chassis, rod.axle, P.links[i].c, P.links[i].a, MM); setGroupB('frod' + rod.name, Bm, MM); });
  stretch(f.trackBar.axle, f.trackBar.chassis, P.tb.a, P.tb.c, MM); setGroupB('ftb', Bm, MM);
  stretch(f.steer.pitman, f.steer.dragOuter, P.drag.i, P.drag.o, MM); setGroupB('drag', Bm, MM);
  stretch(f.steer.tieL, f.steer.tieR, P.tie.L, P.tie.R, MM); setGroupB('tie', Bm, MM);
  // rear
  const c0 = V.mid(r.wheel.L.c, r.wheel.R.c);
  affine(r.wheel.L.c, r.wheel.R.c, r.ladder.axleUp, Rp.T(r.wheel.L.c), Rp.T(r.wheel.R.c), Rp.T(r.ladder.axleUp), MM);
  const tube = SC.torqueTube(Rp, R, v('ttm'));
  if (tube) {
    // the housing turns about the axle to point the tube at the ball; + pitch = nose up, which is
    // a turn the other way about the axle direction (left)
    const C = tube.centre;
    _rot.makeRotationAxis(_vA.set(...tube.axis), -tube.pitch / DEG);
    _tA.makeTranslation(-C[0], -C[1], -C[2]); _tB.makeTranslation(C[0], C[1], C[2]);
    MM.premultiply(_tA).premultiply(_rot).premultiply(_tB);
    const m = r.torqueTube.mesh;
    seg(m.ball, m.nose, tube.ball, tube.nose, _tmp2); setGroupB('tt1', Bm, _tmp2);
    seg(m.nose, m.ball, tube.nose, tube.ball, _tmp2); setGroupB('tt2', Bm, _tmp2);
  }
  setGroupB('raxle', Bm, MM);
  for (const s of ['L', 'R']) {
    tyreScale(r.wheel[s].c, r.wheel[s].axis, HP.rear.wheel[s].r / RBASE[s], _tmp2);
    _sc2.makeTranslation(0, R.wheel[s].c[1] - r.wheel[s].c[1], 0);   // the spacers
    setGroupB('rtyre' + s, Bm, _tmp2.premultiply(_sc2).premultiply(MM));
  }
  r.rods.forEach((rod, i) => {
    const g = Rp.cage[i];
    affine(rod.axle, r.bar[rod.side].arm, c0, g.rodA, g.barArm, Rp.T(c0), MM); setGroupB('rcage' + rod.side, Bm, MM);
    stretch(rod.chassis, rod.axle, g.rodC, g.rodA, MM); setGroupB('rrod' + rod.side, Bm, MM);
    seg(r.bar[rod.side].pivot, r.bar[rod.side].arm, g.barPivot, g.barArm, MM); setGroupB('rbar' + rod.side, Bm, MM);   // rigid, slides on the bar
    shockSeg('rshk' + rod.side + 'b', r.shock[rod.side].chassis, r.shock[rod.side].arm, g.shockC, g.shockA, MM); setGroupB('rshk' + rod.side + 'b', Bm, MM);
    shockSeg('rshk' + rod.side + 'r', r.shock[rod.side].arm, r.shock[rod.side].chassis, g.shockA, g.shockC, MM); setGroupB('rshk' + rod.side + 'r', Bm, MM);
  });
  // the triangle is rigid and swings on its pin, so three of its own points place it
  affine(r.ladder.pin, r.ladder.axleUp, r.ladder.axleLo, Rp.lad.pin, Rp.lad.aUp, Rp.lad.aLo, MM);
  setGroupB('ladT', Bm, MM);
  stretch(r.ladder.chassisUp, r.ladder.axleUp, Rp.lad.cUp, Rp.lad.aUp, MM); setGroupB('ladU', Bm, MM);
  stretch(r.ladder.chassisLo, r.ladder.axleLo, Rp.lad.cLo, Rp.lad.aLo, MM); setGroupB('ladL', Bm, MM);
}
const w3 = (p, Bm) => { tmpV.set(p[0], p[1], p[2]).applyMatrix4(Bm); return tmpV.clone(); };

let lastT = 0;
function frame(now) {
  now = now || performance.now();
  const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 1 / 60); lastT = now;
  let roll, zF, zR;
  const r0 = model ? model.rest : Z;      // every tab starts from the car at its ride heights
  if (driving) driveStep(dt);
  if (tab === 'setup') {
    const e = reduce ? 1 : 0.12;
    shownRoll += ((model ? model.phi : 0) - shownRoll) * e;
    if (model) { shownF += (model.zJF - shownF) * e; shownR += (model.zJR - shownR) * e; }
    const x = exag ? 5 : 1; roll = r0.phi + shownRoll * x; zF = r0.dzF + shownF * x; zR = r0.dzR + shownR * x;
  } else if (tab === 'dyn') {
    const a = dynAttitude(v('d-heave'), v('d-roll'), v('d-pitch'));
    roll = r0.phi + a.roll; zF = r0.dzF + a.zF; zR = r0.dzR + a.zR;
  } else {
    if (sweeping) { sweepT += dt; $('k-heave').value = (Math.sin(sweepT * 1.5) * 2.2).toFixed(2); kOutputs(); }
    shownRoll = v('k-roll') / DEG; roll = r0.phi + shownRoll; zF = r0.dzF + v('k-heave'); zR = r0.dzR + v('k-heave');
  }
  if (loaded) {
    const key = roll.toFixed(4) + '|' + zF.toFixed(3) + '|' + zR.toFixed(3) + '|' + v('k-steer') + '|' + v('wingp') + '|' + v('fwingp') + '|' + v('wingh') + '|' + v('fwingh') + '|' + tab + sel + exag;
    if (key !== lastKey) {
      lastKey = key;
      const P = poseF(-zF, -roll, v('k-steer'), guessF); guessF = P;
      const Rp = poseR(-zR, -roll, guessR); guessR = Rp;
      bodyMatrix(B, roll, zF, zR); B.premultiply(BSET);
      place(P, Rp, B);
      const kf = tab === 'kin' && sel === 'front', kr = tab === 'kin' && sel === 'rear';
      rcF.visible = tbLine.visible = kpLine.L.visible = kpLine.R.visible = jackArrow.visible = kf;
      rcR.visible = ladU.visible = ladL.visible = kr;
      if (kf) {
        const gnd = toGnd(zF, zR, roll), o = frontTable(P, gnd.roll, gnd.pitch);
        const rc = o.rc;
        if (rc) {
          const a = w3(P.tb.a, B), c = w3(P.tb.c, B), d = a.clone().sub(c);
          tbLine.geometry.setFromPoints([c.clone().addScaledVector(d, -0.45), a.clone().addScaledVector(d, 0.3)]);
          tbLine.computeLineDistances();
          const z = w3([P.tb.a[0], 0, rc.z], B);
          rcF.position.copy(z);
          const len = Math.max(2, Math.min(28, Math.abs(model ? model.fj.tot : 0) * 0.04));
          const up = (model ? model.fj.tot : 0) >= 0;
          jackArrow.position.set(c.x, c.y, c.z + (up ? 2 : -2));
          jackArrow.setDirection(new THREE.Vector3(0, 0, up ? 1 : -1)); jackArrow.setLength(len, Math.min(3, len * .4), 2);
        }
        for (const s of ['L', 'R']) {
          const kp = P.kp[s], k = kp.dir[2] > 0 ? kp.dir : V.mul(kp.dir, -1);
          const t0 = (o.A[s].CP[2] - kp.p[2]) / k[2];
          kpLine[s].geometry.setFromPoints([w3(V.add(kp.p, V.mul(k, t0)), B), w3(V.add(kp.p, V.mul(k, 9)), B)]);
        }
      }
      if (kr) {
        rearTable(Rp, roll * DEG);
        const ic = SC.ladderIC(Rp);
        for (const [ln, a, c] of [[ladU, Rp.lad.aUp, Rp.lad.cUp], [ladL, Rp.lad.aLo, Rp.lad.cLo]]) {
          const A = w3(a, B), Cv = w3(c, B), d = A.clone().sub(Cv);
          ln.geometry.setFromPoints([Cv.clone().addScaledVector(d, -0.2), A.clone().addScaledVector(d, 2.6)]);
          ln.computeLineDistances();
        }
        if (ic) rcR.position.copy(w3([Rp.lad.aUp[0], ic.y, ic.z], B));
      }
    }
  }
  controls.update(); renderer.render(scene, cam);
  {
    const w = stage.clientWidth, h = stage.clientHeight;
    TIRE.forEach((p, i) => {
      tmpV.set(p[0], p[1], 26).applyMatrix4(world.matrixWorld).project(cam);
      tags[i].style.left = ((tmpV.x + 1) / 2 * w) + 'px'; tags[i].style.top = ((1 - tmpV.y) / 2 * h) + 'px';
      tags[i].hidden = tmpV.z > 1;
    });
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- saved setups
const SETUP_EL = () => [...document.querySelectorAll('#p-setup input[type=range], #p-setup input[type=number], #wt, #winged')];
const elVal = e => e.type === 'checkbox' ? (e.checked ? '1' : '0') : e.value;
let DEF = {};
const SKEY = 'scsl-setups';
const readSaved = () => { try { return JSON.parse(localStorage.getItem(SKEY)) || []; } catch (e) { return []; } };
let saved = readSaved();
const writeSaved = () => { try { localStorage.setItem(SKEY, JSON.stringify(saved)); } catch (e) { alert('Could not save on this computer. Use Export to keep a file.'); } };
function setSetup(vals) {
  stopDrive();
  // old saves: bar preload in inches at the arm, + = more load, which is rounds in
  if ('plf' in vals && !('rnlf' in vals)) {
    const t = +vals.tpi || +DEF.tpi;
    vals = Object.assign({}, vals, { rnlf: vals.plf * t, rnrf: vals.prf * t, rnlr: vals.plr * t, rnrr: vals.prr * t, rv: 2 });
  }
  // saves from before rv 2 had + rounds = corner down: flip them so they still mean the same car
  if ('rnlf' in vals && !vals.rv) vals = Object.assign({}, vals, ...['rnlf', 'rnrf', 'rnlr', 'rnrr'].map(id => ({ [id]: -vals[id] || 0 })));
  for (const id in vals) if (id in DEF) { const e = $(id); if (e.type === 'checkbox') e.checked = vals[id] === '1' || vals[id] === 1 || vals[id] === true; else e.value = vals[id]; }
}
function snapshot(name) {
  stopDrive(); const inputs = {}; SETUP_EL().forEach(e => inputs[e.id] = elVal(e));
  inputs['k-steer'] = $('k-steer').value; inputs.rv = 2;
  return { name, inputs, fadj: JSON.parse(JSON.stringify(fadj)), radj: JSON.parse(JSON.stringify(radj)), out: outSummary() };
}
function applySnapshot(x) {
  setSetup(x.inputs || {});
  if (x.inputs && x.inputs['k-steer'] != null) $('k-steer').value = x.inputs['k-steer'];
  fadj = Object.assign(JSON.parse(JSON.stringify(FADJ0)), x.fadj || {});
  radj = Object.assign(JSON.parse(JSON.stringify(RADJ0)), x.radj || {});
  FCTL.forEach(([id, key, i]) => $(id).value = i == null ? fadj[key] : fadj[key][i]);
  RCTL.forEach(([id, key, i]) => $(id).value = i == null ? radj[key] : radj[key][i]);
  setRearSelects(); setClockSliders(); kOutputs(); rebuild();
}
function fillLists() {
  for (const id of ['sv-list', 'sv-cmp']) {
    const s = $(id), cur = s.value; s.replaceChildren();
    if (id === 'sv-cmp') s.add(new Option('None', ''));
    saved.forEach((x, i) => s.add(new Option(x.name, i)));
    if ([...s.options].some(o => o.value === cur)) s.value = cur;
  }
  compareTable();
}
function compareTable() {
  const sc = $('sv-cmp'), x = sc && saved[sc.value];
  $('cmp-tab').hidden = !x; if (!x || !model) return;
  $('cmp-name').textContent = x.name.length > 14 ? x.name.slice(0, 13) + '…' : x.name;
  const now = outSummary(), tb = $('cmp-body'); tb.replaceChildren();
  for (const [n, key, d] of OUTROWS) {
    const a = now[key], b = x.out && x.out[key];
    if (b == null) continue;
    const dd = a - b, ds = Math.abs(dd).toFixed(d), moved = +ds !== 0, tr = tb.insertRow();
    [n, a.toFixed(d), b.toFixed(d), (moved ? (dd > 0 ? '+' : '−') : '') + ds].forEach((t, j) => {
      const c = tr.insertCell(); c.textContent = t; if (j === 3 && moved) c.className = 'chg';
    });
  }
}
function download(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('sv-save').onclick = () => {
  const name = $('sv-name').value.trim() || ('Setup ' + (saved.length + 1));
  const x = snapshot(name), i = saved.findIndex(s => s.name === name);
  if (i >= 0) saved[i] = x; else saved.push(x);
  writeSaved(); fillLists(); $('sv-list').value = i >= 0 ? i : saved.length - 1; $('sv-name').value = '';
};
$('sv-load').onclick = () => { const x = saved[$('sv-list').value]; if (x) applySnapshot(x); };
$('sv-del').onclick = () => { const i = $('sv-list').value; if (saved[i] && confirm('Delete "' + saved[i].name + '"?')) { saved.splice(i, 1); writeSaved(); fillLists(); } };
$('sv-exp').onclick = () => { const x = saved[$('sv-list').value]; if (x) download(x.name.replace(/[^\w .-]+/g, '_') + '.json', { app: 'SprintCarSetupLab', kind: 'setup', setup: x }); };
$('sv-imp').onclick = () => $('sv-file').click();
$('sv-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), list = [].concat(j.setup || j.setups || j);
    for (const x of list) {
      if (!x || typeof x.name !== 'string' || typeof x.inputs !== 'object') throw new Error('not a setup file');
      saved = saved.filter(s => s.name !== x.name); saved.push(x);
    }
    writeSaved(); fillLists(); $('sv-list').value = saved.length - 1;
  } catch (err) { alert('Could not import that file: ' + err.message); }
};
$('sv-cmp').onchange = compareTable;
$('reset-setup').onclick = () => { setSetup(DEF); update(); };
$('reset-all').onclick = () => {
  setSetup(DEF); fadj = JSON.parse(JSON.stringify(FADJ0)); radj = JSON.parse(JSON.stringify(RADJ0));
  FCTL.forEach(([id]) => $(id).value = 0); RCTL.forEach(([id]) => $(id).value = 0); setRearSelects(); setClockSliders();
  $('k-steer').value = 0; $('k-heave').value = 0; $('k-roll').value = 0;
  kOutputs(); rebuild();
};

// ---------------------------------------------------------------- hardpoints in and out
let HP0 = null, poseNotes = () => {};
const isPt = p => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && isFinite(n));
function useHardpoints(j, name) {
  const f = j.front, r = j.rear;
  if (!f || !r) throw new Error('needs a "front" and a "rear"');
  if (!Array.isArray(f.rods) || f.rods.length < 2) throw new Error('front.rods must list at least two radius rods');
  for (const rod of f.rods) if (!(isPt(rod.chassis) && isPt(rod.axle))) throw new Error('each front rod needs chassis and axle as [x, y, z] in inches');
  for (const key of ['trackBar']) if (!(isPt(f[key].axle) && isPt(f[key].chassis))) throw new Error('front.' + key + ' needs axle and chassis');
  for (const key of ['pitman', 'dragOuter', 'tieL', 'tieR', 'box']) if (!isPt(f.steer[key])) throw new Error('front.steer.' + key + ' must be [x, y, z]');
  for (const s of ['L', 'R']) {
    if (!(isPt(f.kingpin[s].p) && isPt(f.kingpin[s].dir))) throw new Error('front.kingpin.' + s + ' needs p and dir');
    if (!(isPt(f.wheel[s].c) && isPt(f.wheel[s].axis))) throw new Error('front.wheel.' + s + ' needs c and axis');
    if (!(isPt(r.wheel[s].c) && isPt(r.wheel[s].axis))) throw new Error('rear.wheel.' + s + ' needs c and axis');
    for (const key of ['bar', 'shock']) for (const end of Object.keys(f[key][s])) if (!isPt(f[key][s][end])) throw new Error('front.' + key + '.' + s + '.' + end + ' must be [x, y, z]');
  }
  for (const key of ['chassisUp', 'chassisLo', 'axleUp', 'axleLo']) if (!isPt(r.ladder[key])) throw new Error('rear.ladder.' + key + ' must be [x, y, z]');
  HP = JSON.parse(JSON.stringify(j));
  if (!HP.rear.torqueTube && HP0 && HP0.rear.torqueTube) HP.rear.torqueTube = JSON.parse(JSON.stringify(HP0.rear.torqueTube));
  const d = j.dims || {}; WB = +d.wheelbase || WB; TF = +d.frontTrack || TF; TR = +d.rearTrack || TR;
  RBASE = { L: r.wheel.L.r, R: r.wheel.R.r };
  RT = (RBASE.L + RBASE.R) / 2;
  $('stg').value = ((RBASE.R - RBASE.L) * 2 * Math.PI).toFixed(2);
  DEF['stg'] = $('stg').value;
  buildAll();
  setClockSliders();
  $('hp-note').hidden = !name; $('hp-note').replaceChildren();
  if (name) {
    $('hp-note').append('Using hardpoints from ' + name + '. The 3D parts are still this car, moved to fit. ');
    const b = document.createElement('button'); b.textContent = 'Back to the CAD car';
    b.onclick = () => { try { localStorage.removeItem('scsl-hp'); } catch (e) {} useHardpoints(HP0); };
    $('hp-note').append(b);
  }
  rebuild();
}
$('hp-load').onclick = () => $('hp-file').click();
$('hp-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); useHardpoints(j, f.name); try { localStorage.setItem('scsl-hp', JSON.stringify({ name: f.name, j })); } catch (err) {} }
  catch (err) { alert('Could not use that file: ' + err.message); useHardpoints(HP0); }
};
$('hp-save').onclick = () => download('sprint-hardpoints.json', HP);

// ---------------------------------------------------------------- help, folding
function showHelp(on) { $('help').hidden = !on; $('v-help').setAttribute('aria-expanded', on); }
$('v-help').onclick = () => showHelp($('help').hidden);
$('help-close').onclick = () => { showHelp(false); try { localStorage.setItem('scsl-help', '1'); } catch (e) {} };
try { if (!localStorage.getItem('scsl-help')) showHelp(true); } catch (e) { showHelp(true); }
function foldSections() {
  const fs = [...document.querySelectorAll('aside fieldset')];
  let shut = null; try { shut = JSON.parse(localStorage.getItem('scsl-shut')); } catch (e) {}
  if (!Array.isArray(shut) || shut.length !== fs.length) shut = fs.map(f => /Bar settings|Saved setups/.test(f.querySelector('legend').textContent) ? 1 : 0);
  fs.forEach((f, i) => {
    const lg = f.querySelector('legend');
    f.classList.toggle('shut', !!shut[i]); lg.tabIndex = 0; lg.setAttribute('role', 'button');
    const flip = () => {
      f.classList.toggle('shut'); lg.setAttribute('aria-expanded', !f.classList.contains('shut'));
      try { localStorage.setItem('scsl-shut', JSON.stringify(fs.map(x => x.classList.contains('shut') ? 1 : 0))); } catch (e) {}
    };
    lg.setAttribute('aria-expanded', !f.classList.contains('shut'));
    lg.onclick = flip;
    lg.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
  });
}

// ---------------------------------------------------------------- dynamics
// Set the body's heave, roll and pitch and see the whole car follow. Every chart sweeps one
// of the three (Plot against) with the other two held where the sliders are; the cursor is
// the current pose and the caption reads it out. Pure geometry: no loads.
// + heave = body up, + roll = left side up, + pitch = nose down; heave and pitch are about
// mid-wheelbase, and all three are from the car at its ride heights.
function dynAttitude(heave, rollDeg, pitchDeg) {
  const t = Math.tan(pitchDeg / DEG);
  return { roll: rollDeg / DEG, zF: heave - TIRE[0][0] * t, zR: heave - TIRE[2][0] * t };
}
function dynPoint(heave, rollDeg, pitchDeg, g) {
  const a = dynAttitude(heave, rollDeg, pitchDeg), steer = v('k-steer');
  const r0 = model ? model.rest : Z, zF = r0.dzF + a.zF, zR = r0.dzR + a.zR, roll = r0.phi + a.roll, gnd = toGnd(zF, zR, roll);
  const P = poseF(-zF, -roll, steer, g && g.P), Rp = poseR(-zR, -roll, g && g.Rp);
  const AL = SC.angles(P.wheel.L, 1, P.kp.L), AR = SC.angles(P.wheel.R, -1, P.kp.R);
  const rc = SC.frontRC(P), ic = SC.ladderIC(Rp);
  const cpF = (AL.CP[2] + AR.CP[2]) / 2;
  const cpR = (SC.angles(Rp.wheel.L, 1).CP[2] + SC.angles(Rp.wheel.R, -1).CP[2]) / 2;
  // wheelbase each side: front contact patch to rear, against the car at rest
  const wb = (sd, sg) => SC.angles(P.wheel[sd], sg).CP[0] - SC.angles(Rp.wheel[sd], sg).CP[0] -
    (SC.angles(MR.base.f.wheel[sd], sg).CP[0] - SC.angles(MR.base.r.wheel[sd], sg).CP[0]);
  const xr = TIRE[2][0], ride = i => { const q = Z.pts[i], h = model ? r0.hNow[i] : Z.h[i];
    return h + a.zR + (a.zF - a.zR) * (q.x - xr) / (TIRE[0][0] - xr) + q.y * Math.sin(a.roll); };
  return {
    P, Rp,
    LF: ride(0), RF: ride(1), LR: ride(2), RR: ride(3),
    hf: rc ? rc.z - cpF : NaN, hr: ic ? ic.z - cpR : NaN, rcy: ic ? ic.y : NaN,
    toeL: AL.toe, toeR: AR.toe, camL: AL.camber - gnd.roll, camR: AR.camber + gnd.roll,
    casL: AL.caster - gnd.pitch, casR: AR.caster - gnd.pitch,
    shift: P.u[1], rst: SC.rearSteer(Rp), wbL: wb('L', 1), wbR: wb('R', -1),
    clkL: Rp.cage[0].clock, clkR: Rp.cage[1].clock,
  };
}

// what is plotted: [title, [[key, colour, label], ...]]
const C4 = ['var(--accent)', 'var(--link)', '#2b8a3e', '#c77700'];
const DYNCH = [
  ['Ride height at each corner, in', [['LF', C4[0], 'LF'], ['RF', C4[1], 'RF'], ['LR', C4[2], 'LR'], ['RR', C4[3], 'RR']]],
  ['Roll centre height F / R, in', [['hf', C4[0], 'F'], ['hr', C4[1], 'R']]],
  ['Rear roll centre across, in (+ left)', [['rcy', C4[0]]]],
  ['Toe-out LF / RF, °', [['toeL', C4[0], 'LF'], ['toeR', C4[1], 'RF']]],
  ['Camber to ground LF / RF, °', [['camL', C4[0], 'LF'], ['camR', C4[1], 'RF']]],
  ['Caster to ground LF / RF, °', [['casL', C4[0], 'LF'], ['casR', C4[1], 'RF']]],
  ['Front axle side shift, in (+ left)', [['shift', C4[0]]]],
  ['Rear steer, ° (+ loose)', [['rst', C4[0]]]],
  ['Wheelbase change L / R, in', [['wbL', C4[0], 'L'], ['wbR', C4[1], 'R']]],
  ['Birdcage clocking LR / RR, °', [['clkL', C4[0], 'LR'], ['clkR', C4[1], 'RR']]],
];
const DYNX = { heave: ['d-heave', 'heave, in'], roll: ['d-roll', 'roll, °'], pitch: ['d-pitch', 'pitch, °'] };
const DYNN = 25;
function drawDyn() {
  if (!F || !R) return;
  const xk = $('d-x').value, [xid, xlab] = DYNX[xk], el = $(xid), x0 = +el.min, x1 = +el.max;
  const at = { heave: v('d-heave'), roll: v('d-roll'), pitch: v('d-pitch') };
  const xs = [], q = []; let g = null;
  for (let i = 0; i < DYNN; i++) {
    const o = Object.assign({}, at, { [xk]: x0 + (x1 - x0) * i / (DYNN - 1) });
    xs.push(o[xk]); g = dynPoint(o.heave, o.roll, o.pitch, g); q.push(g);
  }
  const now = dynPoint(at.heave, at.roll, at.pitch);
  const Wd = 300, Ht = 140, l = 40, r = 6, tp = 6, bt = 20;
  const X = x => l + (x - x0) / (x1 - x0) * (Wd - l - r);
  const xst = niceStep((x1 - x0) / 5); let xt = '';
  for (let x = Math.ceil(x0 / xst) * xst; x <= x1 + 1e-9; x += xst) xt += `<text x="${X(x)}" y="${Ht - 6}" text-anchor="middle">${+x.toFixed(2)}</text>`;
  const cx = X(at[xk]);
  $('d-charts').innerHTML = DYNCH.map(([title, ser]) => {
    const all = [].concat(...ser.map(([k]) => q.map(o => o[k]).concat(now[k]))).filter(isFinite);
    if (!all.length) return '';
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max(0.05, (hi - lo) * 0.08); lo -= pad; hi += pad;
    const Y = val => tp + (hi - val) / (hi - lo) * (Ht - tp - bt);
    const step = niceStep((hi - lo) / 3); let ticks = '';
    for (let val = Math.ceil(lo / step) * step; val <= hi; val += step)
      ticks += `<line class="ax" x1="${l}" x2="${Wd - r}" y1="${Y(val)}" y2="${Y(val)}"/><text x="${l - 4}" y="${Y(val) + 3}" text-anchor="end">${+val.toFixed(2)}</text>`;
    // a gap where the solve has no answer (straps parallel), rather than a line through it
    const line = k => q.map((o, i) => isFinite(o[k]) ? (i && isFinite(q[i - 1][k]) ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(o[k]).toFixed(1) : '').join(' ');
    const lines = ser.map(([k, c]) => `<path d="${line(k)}" fill="none" stroke="${c}" stroke-width="1.6"/>`).join('');
    const cap = ser.map(([k, c, lab]) => `<span style="color:${c}">${lab ? lab + ' ' : ''}${isFinite(now[k]) ? now[k].toFixed(Math.abs(now[k]) >= 100 ? 0 : 2) : '—'}</span>`).join('  ');
    return `<figure><figcaption><span style="color:var(--ink)">${title}</span> ${cap}</figcaption>` +
      `<svg class="chart" viewBox="0 0 ${Wd} ${Ht}">${ticks}${xt}${lines}` +
      `<line x1="${cx}" x2="${cx}" y1="${tp}" y2="${Ht - bt}" style="stroke:var(--ink);stroke-width:1"/></svg></figure>`;
  }).join('');
  $('d-xlab').textContent = xlab;
}
const dynOutputs = () => {
  $('d-heave-o').textContent = v('d-heave').toFixed(2);
  $('d-roll-o').textContent = v('d-roll').toFixed(2);
  $('d-pitch-o').textContent = v('d-pitch').toFixed(2);
};
for (const id of ['d-heave', 'd-roll', 'd-pitch']) $(id).addEventListener('input', () => { dynOutputs(); drawDyn(); });
$('d-x').addEventListener('change', drawDyn);
$('d-zero').onclick = () => { for (const id of ['d-heave', 'd-roll', 'd-pitch']) $(id).value = 0; dynOutputs(); drawDyn(); };
dynOutputs();

// ---------------------------------------------------------------- start
const wsel = $('wt');
for (let w = 1300; w <= 1900; w += 25) { const o = document.createElement('option'); o.value = w; o.textContent = w.toLocaleString(); if (w === 1500) o.selected = true; wsel.appendChild(o); }
DEF = {}; SETUP_EL().forEach(e => DEF[e.id] = elVal(e));
SETUP_EL().forEach(e => e.addEventListener('input', ['stg', 'hlf', 'hrf', 'hrr'].includes(e.id) ? rebuild : update));

Promise.all([
  fetch('hp.json').then(r => r.json()),
  fetch('car.glb').then(r => r.arrayBuffer()),
  fetch('tube.glb').then(r => r.arrayBuffer()),
  fetch('wing.glb').then(r => r.arrayBuffer()),
]).then(([hpj, buf, tubeBuf, wingBuf]) => {
  HP0 = JSON.parse(JSON.stringify(hpj));
  let stored = null; try { stored = JSON.parse(localStorage.getItem('scsl-hp')); } catch (e) {}
  try { useHardpointsInit(stored ? stored.j : hpj, stored ? stored.name : null); }
  catch (e) { useHardpointsInit(hpj, null); }

  const addGLB = g => {
    g.scene.updateMatrixWorld(true);
    const nodes = []; g.scene.traverse(o => { if (o.isMesh) nodes.push(o); });
    for (const o of nodes) {
      // "group--surface--part" is written by tools/make_model.py. The separator is "--"
      // because the glTF exporter strips a colon and turns spaces into underscores. Newer
      // trimesh also wraps parts in a node called "world", so only a name that carries the
      // separator counts, the mesh's own first and an ancestor's only as a fallback.
      let n = o.name;
      if (!n || n.indexOf('--') < 0) { let p = o.parent; while (p && p !== g.scene) { if (p.name && p.name.indexOf('--') >= 0) { n = p.name; break; } p = p.parent; } }
      const bits = (n || '').split('--');
      const grp = bits[0] || 'sprung', surf = bits.length > 2 ? bits[1] : 'steel';
      o.updateMatrixWorld(true);
      const M = o.matrixWorld.clone();
      o.parent.remove(o);
      // normals are baked into car.glb with a crease angle, so they are NOT recomputed
      // here - that would smooth every chamfer and plate edge back off again.
      // applyMatrix4 carries the normal attribute through with the vertices.
      o.geometry.applyMatrix4(M);
      o.matrixAutoUpdate = false; o.matrix.identity();
      o.material = matFor(grp, surf);
      carRoot.add(o);
      (G[grp] = G[grp] || []).push(o);
    }
  };
  new THREE.GLTFLoader().parse(tubeBuf, '', addGLB);
  new THREE.GLTFLoader().parse(wingBuf, '', addGLB);
  new THREE.GLTFLoader().parse(buf, '', g => {
    addGLB(g);
    loaded = true; $('loading').hidden = true; lastKey = '';
  }, () => { $('loading').textContent = 'Could not load the car model'; });

  poseNotes = () => {
    // The car is posed at its ride heights, on the ground, and that is the reference for
    // everything here - there is no second, "as drawn" pose to compare against.
    const d = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
    const p0 = MR.base.f, r0 = MR.base.r, gnd = toGnd(Z.dzF, Z.dzR, Z.phi);
    const al = SC.angles(p0.wheel.L, 1, p0.kp.L), ar = SC.angles(p0.wheel.R, -1, p0.kp.R);
    al.caster -= gnd.pitch; ar.caster -= gnd.pitch; al.camber -= gnd.roll; ar.camber += gnd.roll;
    $('asm-geo').innerHTML = '<b>How the car is posed.</b> Wheelbase ' + WB.toFixed(1) +
      ' in, front track ' + TF.toFixed(1) + ' in, rear track ' + TR.toFixed(1) + ' in. ' +
      'All four tires sit on the ground, with the rear axle tilted ' + d(S.psiR * DEG) + '&deg; because ' +
      'the RR tire is bigger in radius and a staggered axle cannot sit square on flat ground. The chassis ' +
      'then sits at the ride heights on the Setup tab, and every travel, roll and alignment number here ' +
      'is read there. At ride height this car has LF caster ' + al.caster.toFixed(1) + '&deg;, RF ' +
      ar.caster.toFixed(1) + '&deg;; KPI ' + al.kpi.toFixed(1) + '&deg; / ' + ar.kpi.toFixed(1) +
      '&deg;; camber ' + d(al.camber) + '&deg; / ' + d(ar.camber) + '&deg;; and the birdcages clocked ' +
      d(r0.cage[0].clock) + '&deg; / ' + d(r0.cage[1].clock) + '&deg;.';
    $('spindle-note').innerHTML = 'Caster and camber as a change from where this car sits: LF ' +
      al.caster.toFixed(1) + '&deg; / RF ' + ar.caster.toFixed(1) + '&deg; caster, ' + d(al.camber) +
      '&deg; / ' + d(ar.camber) + '&deg; camber at ride height. Both tilt the whole end of the axle, so the ' +
      'kingpin and the steering arm go with them &mdash; the kingpin hole is set at a new angle in the ' +
      'axle end, the tube itself does not bend. Camber takes KPI the other way and leaves the ' +
      'included angle alone, and either one moves the bump steer.';
  };
  poseNotes();
  sel = 'front'; applyTab('setup');
  foldSections(); fillLists(); resize(); frame();
}).catch(err => { $('loading').textContent = 'Could not load the car: ' + err.message; });

function useHardpointsInit(j, name) {
  HP = JSON.parse(JSON.stringify(j));
  if (!HP.rear.torqueTube && HP0 && HP0.rear.torqueTube) HP.rear.torqueTube = JSON.parse(JSON.stringify(HP0.rear.torqueTube));
  const d = j.dims || {}; WB = +d.wheelbase || WB; TF = +d.frontTrack || TF; TR = +d.rearTrack || TR;
  RBASE = { L: j.rear.wheel.L.r, R: j.rear.wheel.R.r };
  RT = (RBASE.L + RBASE.R) / 2;
  // the sliders start where the CAD already is, so opening the app changes nothing
  $('stg').value = ((RBASE.R - RBASE.L) * 2 * Math.PI).toFixed(2);
  DEF['stg'] = $('stg').value;
  if (name) { $('hp-note').hidden = false; $('hp-note').textContent = 'Using hardpoints from ' + name + '.'; }
  setRearSelects();
  buildAll();
  // the clocking you would measure is the one with the car on the ground, so take the
  // slider's zero off the settled pose, not off the raw CAD pose
  setClockSliders();
  kOutputs(); recomputeCurves(); update();
}
