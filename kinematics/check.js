// Self-check for axle.js. Run: node kinematics/check.js
// Fails loudly if the solver stops closing the linkage or the signs flip.
const fs = require('fs'), path = require('path');
const SC = require('../launcher/web/axle.js');
const hp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'launcher', 'web', 'hp.json'), 'utf8'));
const { V, D } = SC;
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) { bad++; console.log('  FAIL ' + name + (extra ? '  ' + extra : '')); } };
const f2 = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);

const F = SC.buildFront(hp, {});
const R = SC.buildRear(hp, {});

console.log('front link lengths, in');
F.links.forEach(l => console.log(`  ${l.name.padEnd(3)} ${l.L.toFixed(3)}`));
console.log(`  drag link ${F.Ldrag.toFixed(3)}   tie rod ${F.Ltie.toFixed(3)}`);
console.log('rear link lengths, in');
R.cage.forEach(g => console.log(`  ${g.side} top rod ${g.Lrod.toFixed(3)}   ${g.side} bar arm ${g.Lbar.toFixed(3)}`));
console.log(`  ladder straps ${R.lad.Lup.toFixed(3)} / ${R.lad.Llo.toFixed(3)}`);

// ---- static pose must reproduce the CAD exactly ----
const p0 = SC.poseFront(F, 0, 0, 0);
const r0 = SC.poseRear(R, 0, 0);
ok('front closes at ride height', p0.res < 1e-6, 'residual ' + p0.res.toExponential(1));
ok('rear closes at ride height', r0.res < 1e-6, 'res ' + r0.res.toExponential(1));
ok('front pose is the CAD pose', Math.max(...p0.u.map(Math.abs)) < 1e-6, 'u=' + p0.u.map(v => v.toExponential(1)));
// the rear does NOT sit at the raw CAD pose: the ladder holds the housing centred in the
// chassis, which is 0.66 in across from where the CAD drew it
// snapped to real 1/2 in bracket holes the housing lands within the 1/4 in the clevis
// allowance is about; with a continuous bracket it must land dead centre
ok('rear housing within 1/4 in of centre at rest', Math.abs(R.housingCentre + r0.u[1]) < 0.25,
   'off by ' + (R.housingCentre + r0.u[1]).toFixed(4));
{ const Rc = SC.buildRear(hp, { holePitch: 1e-6 }), pc = SC.poseRear(Rc, 0, 0);
  ok('rear housing dead centre with a continuous bracket', Math.abs(Rc.housingCentre + pc.u[1]) < 0.02,
     'off by ' + (Rc.housingCentre + pc.u[1]).toFixed(4)); }
ok('ladder clevis stays put on the birdcage', R.lad.mount < 1e-9, 'moved ' + R.lad.mount);

const aL = SC.angles(p0.wheel.L, 1, p0.kp.L), aR = SC.angles(p0.wheel.R, -1, p0.kp.R);
console.log('\nfront at ride height, as modelled');
console.log(`  LF camber ${f2(aL.camber)}  caster ${f2(aL.caster)}  KPI ${f2(aL.kpi)}  toe-out ${aL.toe.toFixed(3)}  scrub ${f2(aL.scrub)}  trail ${f2(aL.trail)}`);
console.log(`  RF camber ${f2(aR.camber)}  caster ${f2(aR.caster)}  KPI ${f2(aR.kpi)}  toe-out ${aR.toe.toFixed(3)}  scrub ${f2(aR.scrub)}  trail ${f2(aR.trail)}`);
ok('caster is sprint-car big', aL.caster > 15 && aL.caster < 28 && aR.caster > 15 && aR.caster < 28);

const rc = SC.frontRC(p0), ic = SC.ladderIC(r0);
console.log(`\nfront roll centre  ${rc.z.toFixed(2)} in   track bar ${f2(rc.ang)} deg, rise/run ${rc.ratio.toFixed(4)}`);
console.log(`rear roll centre   ${ic.z.toFixed(2)} in at y ${f2(ic.y)} in   straps ${f2(ic.angUp)} / ${f2(ic.angLo)} deg`);
ok('front RC is above the ground and below the axle', rc.z > 5 && rc.z < 25, rc.z.toFixed(2));
ok('rear RC is high, as a ladder makes it', ic.z > 15 && ic.z < 28, ic.z.toFixed(2));

// ---- a beam axle has no camber gain in roll: the wheels stay square to the track ----
const roll = 2 / D;                                   // 2 deg of body roll, left side up
const p1 = SC.poseFront(F, 0, -roll, 0, p0);          // axle rolls the other way under the body
ok('front rolled pose closes', p1.res < 1e-6, 'residual ' + p1.res.toExponential(1));
const b1 = SC.angles(p1.wheel.L, 1, p1.kp.L);
const camberToGround = b1.camber - roll * D;          // + roll on the left, as in the app
console.log(`\nbody roll +2.00 deg:  LF camber in the body ${f2(b1.camber)}, to the ground ${f2(camberToGround)}`);
ok('beam axle keeps camber to the ground', Math.abs(camberToGround - aL.camber) < 0.05,
   'changed by ' + (camberToGround - aL.camber).toFixed(3));

// ---- roll steer and bump steer: the drag link is fixed to the chassis, so they exist ----
const rs = SC.angles(p1.wheel.L, 1, p1.kp.L).toe - aL.toe;
const rsR = SC.angles(p1.wheel.R, -1, p1.kp.R).toe - aR.toe;
console.log(`  roll steer: LF toe ${rs >= 0 ? '+' : '−'}${Math.abs(rs).toFixed(3)} deg, RF ${rsR >= 0 ? '+' : '−'}${Math.abs(rsR).toFixed(3)} deg`);
const pb = SC.poseFront(F, 1, 0, 0, p0), pd = SC.poseFront(F, -1, 0, 0, p0);
const bsL = (SC.angles(pb.wheel.L, 1, pb.kp.L).toe - SC.angles(pd.wheel.L, 1, pd.kp.L).toe) / 2;
const bsR = (SC.angles(pb.wheel.R, -1, pb.kp.R).toe - SC.angles(pd.wheel.R, -1, pd.kp.R).toe) / 2;
console.log(`  bump steer, deg per in of axle travel: LF ${bsL.toFixed(3)}  RF ${bsR.toFixed(3)}`);
ok('bump steer is not zero (drag link on the chassis)', Math.abs(bsL) > 1e-3);

// ---- steering ----
const ps = SC.poseFront(F, 0, 0, 10, p0);
const sL = SC.angles(ps.wheel.L, 1, ps.kp.L), sR = SC.angles(ps.wheel.R, -1, ps.kp.R);
console.log(`\npitman +10 deg:  LF toe-out ${sL.toe.toFixed(2)}  RF toe-out ${sR.toe.toFixed(2)}  ` +
            `(LF turned ${(sL.toe - aL.toe).toFixed(2)}, RF ${(sR.toe - aR.toe).toFixed(2)})`);
ok('steering moves both wheels the same way', (sL.toe - aL.toe) * (sR.toe - aR.toe) < 0,
   'both toe values should move in opposite signed senses for a left turn');
ok('steering camber follows caster', Math.abs(SC.angles(ps.wheel.L, 1, ps.kp.L).camber - aL.camber) > 0.3);

// ---- camber comes from the axle ends tilting, so it trades against KPI ----
console.log('');
console.log('camber is the axle end tilting: included angle must not move');
for (const [side, sg] of [['L', 1], ['R', -1]]) {
  const base = SC.angles(SC.poseFront(SC.buildFront(hp, {}), 0, 0, 0).wheel[side], sg,
                         SC.poseFront(SC.buildFront(hp, {}), 0, 0, 0).kp[side]);
  for (const dc of [-2, 2]) {
    const adj = { camber: side === 'L' ? [dc, 0] : [0, dc] };
    const p = SC.poseFront(SC.buildFront(hp, adj), 0, 0, 0);
    const a = SC.angles(p.wheel[side], sg, p.kp[side]);
    console.log(`  ${side}F camber ${dc >= 0 ? '+' : ''}${dc}: camber ${f2(a.camber)}  KPI ${f2(a.kpi)}  ` +
                `included ${f2(a.camber + a.kpi)} (was ${f2(base.camber + base.kpi)})`);
    ok(`${side}F camber ${dc} moves camber by ${dc}`, Math.abs(a.camber - base.camber - dc) < 0.02);
    ok(`${side}F camber ${dc} holds the included angle`,
       Math.abs((a.camber + a.kpi) - (base.camber + base.kpi)) < 0.02);
  }
}

// ---- anti-dive (front) and anti-squat (rear) ----
const WB = hp.dims.wheelbase, HCG = 18;
console.log('');
console.log('anti-dive / anti-squat at CG height 18 in, before brake split');
for (const side of ['L', 'R']) {
  const v = SC.antiPct(h => SC.poseFront(F, h, 0, 0, p0), side, side === 'L' ? 1 : -1, WB, HCG);
  console.log(`  ${side}F anti-dive ${v.toFixed(1)}%`);
  ok(side + 'F anti-dive is in a believable band', Math.abs(v) < 80, v.toFixed(1));
}
for (const side of ['L', 'R']) {
  const v = SC.antiPct(h => SC.poseRear(R, h, 0, r0), side, side === 'L' ? 1 : -1, WB, HCG);
  console.log(`  ${side}R anti-squat ${v.toFixed(1)}%`);
  ok(side + 'R anti-squat is in a believable band', Math.abs(v) < 120, v.toFixed(1));
}

// ---- ride height: the stock heights sit the body ~2.2 in (front) / 3.2 in (rear) below the
// settled CAD, so the linkage has to close from there through the whole slider range ----
for (const q of Object.values(hp.chassis.ride)) ok('ride point is a low point on the chassis', q[2] > 5 && q[2] < 12, q);
{
  const front = [...Array(13).keys()].map(i => 2.2 - 3 + i / 2), rear = front.map(h => h + 1);
  ok('front closes through travel at ride height', front.every(h => SC.poseFront(F, h, 0, 0).res < 1e-6));
  ok('rear closes through travel at ride height', rear.every(h => SC.poseRear(R, h, 0).res < 1e-6));
}

// ---- rear steer and birdcage rotation in roll ----
const r1 = SC.poseRear(R, 0, -roll, r0);
ok('rear rolled pose closes', r1.res < 1e-6, 'res ' + r1.res.toExponential(1));
const yawDeg = SC.rearSteer(r1);
// the sign has to match the wheels: + = LR ahead of RR, both as it sits and as it changes
{
  const lead = p => p.wheel.L.c[0] - p.wheel.R.c[0];
  for (const p of [r0, r1])
    ok('rear steer + means the LR is ahead of the RR', Math.sign(lead(p)) === Math.sign(SC.rearSteer(p)),
       'steer ' + SC.rearSteer(p).toFixed(4) + ' LR lead ' + lead(p).toFixed(4));
  ok('rear steer change follows the LR moving ahead', Math.sign(lead(r1) - lead(r0)) === Math.sign(yawDeg - SC.rearSteer(r0)));
}
console.log(`\nbody roll +2.00 deg:  rear steer ${f2(yawDeg)} deg  axle side shift ${f2(r1.u[1])} in  ` +
            `birdcages ${f2(r1.cage[0].ang)} / ${f2(r1.cage[1].ang)} deg`);
ok('the birdcages actually turn', Math.abs(r1.cage[0].ang) > 1e-3 && Math.abs(r1.cage[1].ang) > 1e-3);

// ---- motion ratios: torsion arm end travel per inch of wheel travel ----
console.log('\nmotion ratios (arm end, and shock, per in of wheel travel)');
for (const side of ['L', 'R']) {
  const up = SC.poseFront(F, 0.5, 0, 0, p0), dn = SC.poseFront(F, -0.5, 0, 0, p0);
  const dw = up.wheel[side].c[2] - dn.wheel[side].c[2];
  const da = up.bar[side].arm[2] - dn.bar[side].arm[2];
  const ds = V.dist(up.shock[side].chassis, up.shock[side].axle) - V.dist(dn.shock[side].chassis, dn.shock[side].axle);
  console.log(`  ${side}F  bar arm ${(da / dw).toFixed(3)}   shock ${(-ds / dw).toFixed(3)}`);
  ok(side + 'F bar motion ratio is sane', Math.abs(da / dw) > 0.3 && Math.abs(da / dw) < 1.6);
}
for (const [i, side] of ['L', 'R'].entries()) {
  const up = SC.poseRear(R, 0.5, 0, r0), dn = SC.poseRear(R, -0.5, 0, r0);
  const dw = up.wheel[side].c[2] - dn.wheel[side].c[2];
  const da = up.cage[i].barArm[2] - dn.cage[i].barArm[2];
  const ds = V.dist(up.cage[i].shockC, up.cage[i].shockA) - V.dist(dn.cage[i].shockC, dn.cage[i].shockA);
  console.log(`  ${side}R  bar arm ${(da / dw).toFixed(3)}   shock ${(-ds / dw).toFixed(3)}`);
  ok(side + 'R bar motion ratio is sane', Math.abs(da / dw) > 0.3 && Math.abs(da / dw) < 1.6);
}

// ---- the solver must track a full travel sweep without losing the branch ----
let worst = 0, worstShift = 0, worstRes = 0, worstStrap = 0, worstTri = 0;
let g = p0, gr = r0;
for (let h = -3; h <= 3.0001; h += 0.1) {
  g = SC.poseFront(F, h, 0, 0, g); worst = Math.max(worst, g.res);
  gr = SC.poseRear(R, h, 0, gr); worstRes = Math.max(worstRes, gr.res);
  worstShift = Math.max(worstShift, Math.abs(gr.u[1]));
  worstTri = Math.max(worstTri, Math.abs(gr.triAng));
  worstStrap = Math.max(worstStrap,
    Math.abs(V.dist(gr.lad.aUp, gr.lad.cUp) - R.lad.Lup), Math.abs(V.dist(gr.lad.aLo, gr.lad.cLo) - R.lad.Llo));
}
g = p0; gr = r0;
for (let a = -4; a <= 4.0001; a += 0.1) {
  g = SC.poseFront(F, 0, a / D, 0, g); worst = Math.max(worst, g.res);
  gr = SC.poseRear(R, 0, a / D, gr); worstRes = Math.max(worstRes, gr.res);
  worstStrap = Math.max(worstStrap,
    Math.abs(V.dist(gr.lad.aUp, gr.lad.cUp) - R.lad.Lup), Math.abs(V.dist(gr.lad.aLo, gr.lad.cLo) - R.lad.Llo));
}
console.log('');
console.log(`sweep +-3 in and +-4 deg: worst front residual ${worst.toExponential(1)}`);
console.log(`  rear axle side shift over +-3 in of heave: ${worstShift.toFixed(3)} in   ` +
            `worst strap length error ${worstStrap.toExponential(1)} in   triangle swing ${worstTri.toFixed(1)} deg`);
ok('front solver holds over the whole sweep', worst < 1e-5);
ok('rear solve stays exact through the sweep', worstRes < 1e-6, worstRes.toExponential(1));
ok('the straps keep their length through the sweep', worstStrap < 1e-6, worstStrap.toExponential(1));

// ---- moving a pivot must not move the car at ride height ----
const F2 = SC.buildFront(hp, { rodCz: [1, 0, 0], rodCx: [2, -1, 3], tbA: 1.5 });
const q0 = SC.poseFront(F2, 0, 0, 0);
ok('moving front pivots holds ride height', Math.max(...q0.u.map(Math.abs)) < 1e-6);
const R2 = SC.buildRear(hp, { rodCz: [1, -1], rodCx: [2, -3], clevis: 0.625 });
const s0 = SC.poseRear(R2, 0, 0);
ok('moving rear pivots keeps the housing near centre', Math.abs(R2.housingCentre + s0.u[1]) < 0.25,
   'off by ' + (R2.housingCentre + s0.u[1]).toFixed(4));
console.log(`moved pivots: front RC ${SC.frontRC(q0).z.toFixed(2)} in (was ${rc.z.toFixed(2)}), ` +
            `rear RC ${SC.ladderIC(s0).z.toFixed(2)} in (was ${ic.z.toFixed(2)})`);

console.log('');
console.log('torsion arms keep their length and the ladder does not twist, through travel');
{ let g = null, arm = 0, twist = 0, slideSpan = [1e9, -1e9];
  for (const [h, a] of [[0, 0], [3, 0], [-3, 0], [0, 4], [0, -4], [2, 3], [-2, -3]]) {
    const p = SC.poseRear(R, h, a / D, g); g = p;
    p.cage.forEach((c, i) => {
      arm = Math.max(arm, Math.abs(Math.hypot(c.barArm[0] - c.barPivot[0], c.barArm[2] - c.barPivot[2]) - R.cage[i].Lbar),
                          Math.abs(V.dist(c.barArm, c.barPivot) - V.dist(R.cage[i].barArm, R.cage[i].barPivot)));
      slideSpan = [Math.min(slideSpan[0], c.slide), Math.max(slideSpan[1], c.slide)];
    });
    const xs = [p.lad.pin[0] - R.lad.pin[0], p.lad.aUp[0] - R.lad.aUp[0], p.lad.aLo[0] - R.lad.aLo[0]];
    twist = Math.max(twist, Math.max(...xs) - Math.min(...xs));
  }
  console.log(`  arm length change ${arm.toExponential(1)} in, slide ${slideSpan[0].toFixed(3)} to ${slideSpan[1].toFixed(3)} in, ladder twist ${twist.toExponential(1)} in`);
  ok('torsion arms never change length', arm < 1e-6, arm.toExponential(1));
  ok('ladder triangle stays in its plane', twist < 1e-9, twist.toExponential(1));
}
// ---- the torque tube points at its ball through the travel, and the halves keep overlapping ----
{ let worst = 0, ov = [1e9, -1e9], g = null;
  for (let h = -3; h <= 3.001; h += 0.5) {
    const p = SC.poseRear(R, h, 0, g); g = p;
    const t = SC.torqueTube(p, R, 0);
    const miss = V.len(V.cross(V.sub(t.ball, t.nose), t.dir));
    worst = Math.max(worst, miss, t.res); ov = [Math.min(ov[0], t.overlap), Math.max(ov[1], t.overlap)];
  }
  console.log(`  torque tube: misses the ball by ${worst.toExponential(1)} in, overlap ${ov[0].toFixed(2)} to ${ov[1].toFixed(2)} in`);
  ok('torque tube points at the ball through the travel', worst < 1e-6, worst.toExponential(1));
  ok('torque tube halves keep overlapping', ov[0] > 2, ov[0].toFixed(2));
}
console.log('');
console.log('ladder and strap combinations: centred if the straps reach, else moved right just enough');
for (const [n, run] of [['13 1/4', 12.80], ['13 5/8', 13.15625], ['14', 13.5]]) for (const st of [6, 7, 8]) {
  const Rc = SC.buildRear(hp, { ladderRun: run, strap: st });
  const pc = SC.poseRear(Rc, 0, 0), off = Rc.housingCentre + pc.u[1], sh = Rc.lad.shift;
  console.log(`  ${n} / ${st} in   housing ${f2(off)}  moved right ${sh.toFixed(2)}  clevis ${Rc.lad.mount.toFixed(3)}  res ${pc.res.toExponential(1)}`);
  // a short strap lies flat at the ideal, so any hole snap can only push the housing further right
  ok(`${n} / ${st} within 1/4 in of target on real holes`, sh > 0 ? off + sh < 0.02 && off + sh > -0.6 : Math.abs(off) < 0.25, (off + sh).toFixed(4));
  const Rk = SC.buildRear(hp, { ladderRun: run, strap: st, holePitch: 1e-6 }), pk = SC.poseRear(Rk, 0, 0);
  ok(`${n} / ${st} on target on a continuous bracket`, Math.abs(Rk.housingCentre + pk.u[1] + Rk.lad.shift) < 0.02,
     (Rk.housingCentre + pk.u[1] + Rk.lad.shift).toFixed(4));
  // the clevis hole must not move the chassis holes
  const Ru = SC.buildRear(hp, { ladderRun: run, strap: st, clevis: 0.625 });
  ok(`${n} / ${st} clevis leaves the chassis holes alone`,
     Math.abs(Ru.lad.cUp[2] - Rc.lad.cUp[2]) < 1e-9 && Math.abs(Ru.lad.cLo[2] - Rc.lad.cLo[2]) < 1e-9);
  ok(`${n} / ${st} keeps the clevis within 1/4 in`, Rc.lad.mount <= 0.25 + 1e-6);
  ok(`${n} / ${st} closes`, pc.res < 1e-6, pc.res.toExponential(1));
}

console.log(bad ? `\n${bad} check(s) failed` : '\nall checks passed');
process.exit(bad ? 1 : 0);
