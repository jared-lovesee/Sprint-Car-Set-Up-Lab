# Rear bar split (9:16, 41 s)

The same two rear torsion bars, 0.875 and 0.975, swapped side to side, at 0.8 g on throttle, 0 lateral, no wing.
The torque tube lifts the rear on throttle, both bars unwind, and the stiffer one sheds more load, so the stiff
side decides which rear tire gains. Every number is solved live from the lab.

- `barsplit.js`: the video. Built on `../rollcenter_video/rc.js` and rendered the same way.
- `storyboard.html`: the review storyboard (published as an artifact); its numbers predate the CAD torque tube.
- `frames/` + `save_server.py`: the storyboard stills.
- `put_server.py`: static server that saves PUT bodies into `out/`.

To render: copy `launcher/web` to a scratch folder, add `logo.png` (Primary Compact OnDark from the brand kit),
and add after `app.js` in its index.html:

    <script src="https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js"></script><script src="barsplit.js"></script>

Serve it with `put_server.py <folder> 8773`, open it in a browser, then `await VID.init(); await VID.render()`
(about 35 s) -> `out/barsplit.mp4`. `VID.still(t, name)` writes one frame.
