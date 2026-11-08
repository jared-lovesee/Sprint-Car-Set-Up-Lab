# Roll centers short (9:16, 56 s)

Front track bar height and the Jacobs ladder clevis hole, and what each does to LR load on corner exit
(0.7 g lateral, 0.5 g longitudinal, no wing). Ten 5 s shots plus a 6 s end card, one header each, no sound.

- `rc.js`: the video. Rendered shots use the lab's globals; the three app shots (exit, tbarapp, ladapp) come from cap/.
- `caprc.js`: films the real app for those three shots (same as the release short's cap.js, Playwright). It hides the
  wing markers, since with no wing they read as roll center dots.

Render the same way as the release short (see ../release_video/README.md): a scratch copy of launcher/web with
logo.png, the mp4-muxer script and rc.js appended to index.html, served on 8771 by save_server.py;
`node caprc.js run` (~3.5 min), then `await VID.init(); await VID.render()` (~3 min) -> out/rollcenters.mp4.

The comparison cards solve both setups at exit with the body rolled, so their RC heights differ by a few tenths from
the app footage, which reads them on the Kinematics tab at rest.
