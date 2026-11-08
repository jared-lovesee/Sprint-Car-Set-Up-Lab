# Sprint Car Setup Lab: source

Same idea as Late Model Setup Lab, for the dirt sprint car: a 3D car you can roll, heave
and steer, with a setup sheet beside it. The suspension is the sprint car's own — a beam
front axle on radius rods with a track bar and drag link steering, and a Winters rear on
radius rods and torsion bar arms located by a Jacobs ladder.

## The short version
- **To use the app:** open "Sprint Car Setup Lab" from your Desktop or Start menu.
- **After changing anything in this folder:** double-click `Build and Install.bat`. It rebuilds the app and updates the shortcuts. Close the app first. Add `nosign` to skip code signing.
- **After re-exporting the CAD:** run `tools/hardpoints.py`, then `tools/make_model.py`, then `node kinematics/check.js`, then rebuild.

## What's where
- `launcher/web/index.html`: the page — layout, controls and the text.
- `launcher/web/app.js`: the car model (loads, roll, jacking), the read-outs and the 3D.
- `launcher/web/axle.js`: the kinematics. One rigid-axle solver, used at both ends.
- `launcher/web/hp.json`: the hardpoints, written by `tools/hardpoints.py`.
- `launcher/web/car.glb`: the 3D car, written by `tools/make_model.py`.
- `launcher/web/lib/`: three.js and the fonts, so it works offline.
- `launcher/*.go`: the small Windows program that serves `web/` and opens it in an Edge window.
- **The rear housing is kept centred in the chassis**, always. With the bracket welded and the straps staying on their mounts, the only place left to take it up is the ladder's own mount on the RR, so `buildAll()` solves that shim (it moves the rear end almost 1:1, so a couple of passes do it) and reports it rather than making you chase it. As drawn the housing sits 0.66 in right of the centreline, so the default shim is +0.63 in out; a 14 in ladder wants +1.33, 8 in straps want −0.50.
- **Rear top radius rod length** (LR / RR) is a real length change: moving a rod's mounting hole re-sets its length to hold the axle, but turning the rod end in or out changes the length, so the birdcage swings and the axle steers. On this car LR +1 in gives −0.81° of rear steer (the LR goes back, so the axle aims further left) and +0.63 in of LR wheelbase; both +1 in gives about 0.5 in of wheelbase and almost no steer.
- **Rear wheel spacing** is per side, ± from where the CAD has it, 0 as built, + further out. It is rear track and nothing else — the housing stays centred, so spacing one side asymmetrically moves that wheel and leaves the rear end where it is (`housingCentre` is taken before the spacers for exactly this reason).
- **Birdcage clocking** is the angle of the line from the torsion arm mount up to the radius rod mount, off vertical in side view, + = top forward. The cage is one piece and the **torsion arm is a fixed length** — splined to its bar, free only to slide along it — so the cage turns to wherever the top rod puts it: clocking is set by turning the rod end. The clocking slider solves the rod length (`clockTo`), the rod length slider updates the clocking, and the two always agree. At rest this car reads LR +2.3° / RR +1.5°.
- **Torsion arms are rigid and slide on their bars.** The constraint is the ball's side-view distance from the bar axis, so the arm keeps its length and slides sideways to stay in line with its birdcage — about 0.63 in at rest, most of it the housing being centred, and roughly ±0.2 in through travel. The rear shock's lower mount is on the arm and follows it.
- **The Jacobs ladder hangs off the birdcage on a heim.** Only the pin point goes with the cage; the triangle is carried across to it and swings in its own plane, so it never twists with the cage's rotation.
- **Stagger sizes the LR tyre** rather than only feeding a formula: the RR is left where the CAD drew it and the LR is sized off the circumference difference. A staggered axle cannot sit flat on level ground, so the rear tilts, which moves the settle, the rear roll centre and the corner weights — and the tyre changes diameter in the 3D (its own group, scaled about its centre perpendicular to the spin axis).
- **Steering and spindle adjustments**: drag link length (aims the LF, so both wheels move together — centring), **which hole the drag link takes on the pitman arm** (a strong bump steer adjuster — ±2 in along the arm takes the LF from −0.32 to −1.32 °/in, and moves the steering ratio 2.28 → 3.11 °/° with it, while leaving toe alone), crossover bar length (sets the RF against the LF — toe), and caster and camber per front corner. Both caster and camber tilt the whole end of the axle **about where the kingpin crosses the axle tube centreline** (`front.kingpin.<side>.bend` in hp.json, fitted by `tools/hardpoints.py`): pivot anywhere else and the spindle swings off its mounting. Camber on a beam axle is the ends of the tube tilting in, which takes KPI the other way and leaves the included angle alone (asserted in `kinematics/check.js`), and either one moves bump steer. The axle tube itself does **not** bend: the kingpin hole is set at a new angle in the axle end, and that is all that moves. Toe is read out in degrees and in inches.
- `kinematics/check.js`: `node kinematics/check.js` — runs the solver over its whole travel and prints the geometry. Run it after any change to `axle.js` or the hardpoints.
- **Ride height** is ground to the lowest part of the chassis at each corner: `hp.chassis.ride`, four points written by `tools/hardpoints.py` from the chassis mesh (the rail low spots at x ±48.8, y about ±10.6). As in the Late Model lab, the frame is rigid, so LF, RF and RR set the body plane and the LR floats (`rideSet()`); stock is LF 7, RF 7.25, RR 7.5, LR floats to 7.25. That sits the body about 0.8 in above (front) and 0.2 in below (rear) the settled CAD, and that pose is the reference for everything: Kinematics and Dynamics sliders, motion ratios, birdcage clocking, wheel travel, wheelbase change and the bump steer series. Camber and caster are read to the ground, settle included. The CG height you set is the height at ride height, so it does not move with the ride height boxes.
- **Rounds** are on the bar stop bolt and replace the old bar preload sliders: one round is 1/TPI inches at the bar arm. + = rounds in, that corner goes up and it and the opposite corner gain load; rounds out lowers the corner. Saves from before this change are flipped on load so they still mean the same car. They change the scaled weights and move the body off the set heights on a rigid chassis; the Ride ht now row shows where it ends up. Old saves with bar preload load as the equivalent rounds.
- **Radius rod frame mounts fore/aft**: every radius rod (3 front, 2 rear top) has a frame fore/aft slider, + = forward. The rod lengthens with it, so the axle stays where it is and only the chassis mount moves.
- **Torque tube** (CAD parts added 2026-11-07, `tools/torque_tube.py` -> `tube.glb` + `hp.json` rear.torqueTube): the rear half bolts to the rear end nose, the front half carries the torque ball in the engine plate (a chassis point), and the halves telescope (7.03 in overlap as drawn). It carries no fore-aft load, so it does not move the axle: it sets the housing's pitch about the axle, the one rotation the birdcages leave free. `SC.torqueTube` solves the pitch that points the bolted-on tube at the ball. On throttle (Long g > 0) the ball pushes the chassis up by axle torque / lever, lever = axle to ball along the tube (35.6 in at ride height), and the rear springs carry that much less. Axle torque = engine torque x gear, capped at what the rear tires can put down. **Torque ball fore/aft** moves the ball from where the CAD has it. The tube's pose was taken from the new export but applied to the suspension the app already uses; that export also re-posed the rear end, which has not been adopted.
- **Rear steer** is where the axle actually aims against the chassis centreline, + = aims right (LR ahead of RR), loose; − = RR ahead, tight. Read it only through `SC.rearSteer()`: the pose's yaw `u[2]` is measured from the axle as the CAD drew it and is + counter-clockwise (RR ahead), which is how the app once showed it with the sign backwards. At rest this car's axle aims 0.40–0.48° left (RR about 0.4 in ahead as drawn); `check.js` ties the sign to the wheel positions.
- **Banking** (Track, 0 to 20°, rising to the right): Lateral g is the cornering g, speed squared over radius. On the banking `calc()` resolves it and gravity into the track surface: the tires feel `g·cosθ − sinθ` sideways (it goes negative, toward the infield, when the car is slow for the banking) and the car pushes `cosθ + g·sinθ` times its weight into the track. That multiplier scales the scaled corner weights (not the wing, which is not weight) and squats the springs; roll, load transfer, front jacking and grip use the sideways part. The 3D tilts the ground, car and overlays together. At 0° every number is unchanged.
- **Wing position** (Track): the top wing's centre of pressure starts 75% of the frame length back from the nose (frame x +60.12 to -58.67, 118.79 in, measured off the sprung meshes; `FRAME` in app.js), and the slider moves it in inches, + = forward. Its downforce splits between the axles by lever: at 0 that is 83.7% rear. Replaced the old "wing to rear, %". **Front wing**: downforce 0-400 lb and its own position, 0 = over the front axle, + = forward, split by lever the same way (ahead of the axle the front takes over 100% and the rear loses the rest). Each wing has an orange marker at its position: the top wing's above the cage (`WING_Z`), the front wing's just clear of the frame over the front axle (`FWING_Z`); the blue dot is still the CG. **One camera for every tab** (`camKey`), so switching tabs keeps your view.
- **Forces** (Setup tab, under Track): bite = LR load. Forward bite = drive force the rears can still put down after the side force they are making, and side bite = side force they can still make after the drive force, both lb on the same friction circle the balance uses (`mu(Fz)`, rears combined). Drive force = weight x Long g when Long g is positive. Rear jacking: the ladder triangle is pinned to the birdcage, so the straps' resultant runs from their crossing (the IC) through the pin; rear sprung side force x that line's rise over run, fed into the rear heave the same way the track bar's is at the front. Anti-squat force per side = that tire's drive force (split by load) x its side-view link slope (`antiPct`). Driveshaft torque = drive x rear tyre radius / **Rear gear ratio** (5.50 is a placeholder), loading the LR and unloading the RR at the housing. Anti-squat asymmetry and driveshaft torque are moments between the housing and the chassis, so they cannot change the car's total roll moment: they warp it, LR and RF up, RR and LF down, with the rear keeping Kf / (Kf + Kr) of it. **Jacking reads + = pulls down** (Jared's shop convention) everywhere it is shown, front included; the model's `fj.tot` / `rj.tot` stay + = lifts.
- **Dynamics tab**: charts on half the screen, car on the other. Heave (+ body up), roll (+ left up) and pitch (+ nose down) sliders pose the body, about mid-wheelbase, and the 3D follows. Ten charts sweep whichever of the three you plot against, with the other two held where the sliders are, and a line marks the current pose: chassis height at each corner, front/rear roll centre heights, rear RC across, toe, camber and caster to ground, front axle side shift, rear steer, wheelbase change each side, birdcage clocking. Geometry only - steering comes from the Kinematics tab, no loads. (A simulated lap with a speed profile was built and then removed as more than this tool needs.)

## Try changes without rebuilding
Open a terminal in `launcher/web` and run `python -m http.server 8000`, then open
http://localhost:8000. (Double-clicking index.html won't work: the browser blocks loading
`car.glb` and `hp.json` from a file.) `http.server` does not send no-store the way the
launcher does, so hard-refresh (Ctrl+F5) after editing `axle.js`, `app.js` or `hp.json`,
or you will be looking at the cached copy and wondering why nothing changed.

## The two pipelines

**Hardpoints.** `tools/hardpoints.py` reads the per-part STL export and writes
`launcher/web/hp.json`. Every pivot on this car is a rod end, and SolidWorks exports the
ball of each one as its own part, so a sphere fit gives the exact pivot rather than a
centroid guess. Kingpin axes come from the spindles: drop the faces belonging to the stub
axle and fit the cylinder that is left. It prints caster, KPI, camber, toe and where each
contact patch sits, so an export that is turned or not settled shows up straight away.

**The model.** `tools/make_model.py` writes `car.glb` in the vehicle frame (x forward, y
left, z up, origin mid-wheelbase / centreline / ground) and puts each part's moving group
and surface into the node name as `group--surface--part`. Grouping is decided there, by
position against the hardpoints, not in the browser by part name — part names in this
export do not say which corner anything is on. The separator is `--` because the glTF
exporter strips a colon. Shock internals and the rod-end balls are dropped; nothing of
them shows.

It also bakes per-vertex normals with a 35 degree crease angle. An STL carries no
smoothing groups, so welding the vertices and averaging every normal rounds off chamfers,
plate edges and tube ends — that is what makes a machined part look like soap. The faces
are split into groups that only ever meet at shallow angles and averaged within each
group, so sharp edges survive. The app therefore does **not** call `computeVertexNormals`;
doing so would smooth them all off again. This roughly doubles the vertex count, which is
why `car.glb` is 8.3 MB rather than 4.9.

**Colour says what a part does, surface says what it is made of.** Colour comes from the
group — sprung grey, link orange, unsprung dark — so the legend keeps working. The surface
(`steel`, `alloy`, `chrome`, `tyre`) only sets metalness and roughness, except tyres and
shock shafts which also get their own colour. That way a tyre can stop looking like chrome
without breaking the colour coding the app teaches with.

## How the 3D parts are driven

Each moving group gets a matrix built from the solved geometry. Two kinds:

- **`seg`** pins one end and swings the part, keeping its length. Shocks (drawn as two
  halves so they telescope), the forged torsion bar arms and the pitman arm.
- **Shocks** go through `shockSeg`: in the CAD export each body runs through its top eye and each shaft through its lower eye, but the two point slightly differently (0.6-0.8 deg, the RR body 3.6 deg off its eye-to-eye line). So each part's own axis is found from its mesh once and aimed down the posed eye-to-eye line from its own eye, and body and shaft stay coaxial through all travel (within 0.1 deg / 0.03 in).
- **`stretch`** pins both ends and scales the part along its own axis so each end stays
  concentric with its hole. Everything with threaded ends or bolt holes: the radius rods,
  the track bar, the drag link and tie rod, and the Jacobs ladder straps. Nothing stretches
  while the car just moves - the solver holds every one of those lengths - only when you
  move a hole, or index a birdcage, which is exactly when the part on the car would be
  re-set to a new length.

## Things found in the CAD, worth knowing

- **Three front radius rods**, which is how a sprint car is built: the left front lower rod holds the axle fore and aft and the right upper controls its tilt. With the track bar that is four links on the beam axle, exactly the two degrees of freedom it needs — and it is why the two sides give different anti-dive.
- **The front torsion arm stops 2 in behind the axle** and whatever joins it is not in the export. The model rides the arm tip with the axle at that point, which sets the motion ratio (about 0.99 a side).
- **The Jacobs ladder is built from the parts you would buy.** The ladder is the triangle: a 7 in vertical member whose two holes take the straps, running out to a clevis pinned to the right-rear birdcage. Catalogue sizes quote its long tube and what that sets is the horizontal run — 13 1/4 → 12.80, 13 5/8 → 13 5/32, 14 → 13 1/2. The straps are a separate part, 6 / 7 / 8 in, and the clevis has three holes 5/8 in apart.
- **Three things hold for every ladder configuration**: the chassis bracket is welded where it is, the clevis picks up the birdcage at the same place, and the housing sits centred in the chassis. What gives is the **height of the strap holes** on the bracket. `buildRear` solves the ideal heights with the triangle at its drawn angle, then **snaps them to the bracket's hole pattern** (spacing selectable, 1/2 in default, pattern lined up on the CAD's own holes), and the **Upper / Lower strap hole** sliders move each one by whole holes from there. Off the ideal, the rear end goes where the straps put it and the read-out says how far: on real 1/2 in holes it stays within about 0.1 in of centre, and moving a hole by hand moves it more. The clevis may move up to 1/4 in out on the birdcage to let a strap that is just short reach. Past that (Jared, 2026-11-06) the housing gives up being centred: the whole rear end moves right toward the bracket until the longer strap lies flat, and the ladder note says how much wheel spacing puts the wheels back (LR out +s, RR out -s) - set by hand. Nothing is greyed out. With the bracket where the CAD has it, the rear end moves right 0.64 (13 1/4 / 6), 0.99 (13 5/8 / 6), 1.34 (14 / 6) and 0.34 in (14 / 7); every other combo stays centred.
- **The clevis hole moves the ladder on the birdcage and nothing else** — the chassis holes are chosen off the middle clevis hole, so picking another one leaves them where they are. It is the rear roll centre height adjuster: 15.54 / 16.34 / 17.16 in on the default parts.
- **The settle is the starting point, and the ride heights are the reference.** The ride heights above are set from this settled car. The suspension stays where the CAD drew it — that position is the design, not something to be corrected — and the **chassis** is dropped onto the ground around it: −1.50 in, pitched +0.80°, rolled −0.34°, landing all four contact patches to 3e-15 in. The one thing that has to articulate is the rear axle's roll, −1.66°, because the RR tyre is an inch bigger in radius and a staggered axle cannot sit square on flat ground. `settleCar()` in app.js solves those four unknowns against the four patches; the result is baked into `BSET`, which the body matrix is premultiplied by. Travel, ride height and roll are measured from the CAD position of the suspension, so at rest the front pose solves to exactly zero.
- **The steering is turned about 1.9 deg right** in the export. The app centres it: `buildAll()` solves the drag link length that points the fronts straight at ride height, on every rebuild, and the Drag link length slider is a trim from there. At stock that is +0.198 in on the drag link, toe-out 0.27 each side, camber to ground −1.75 LF / +0.91 RF, and bump steer close to zero (+0.04 / −0.03 °/in).

## Rebuild the exe by hand
`Build and Install.bat` does this for you. By hand, in a terminal in `launcher`:
`go build -trimpath -ldflags "-s -w -H windowsgui" -o SprintCarSetupLab.exe .`
Everything in `web/` is built into the exe. The installed copy lives in
`%LOCALAPPDATA%\SprintCarSetupLab`. It serves 127.0.0.1:47392, so it can run alongside
Late Model Setup Lab on 47391.
