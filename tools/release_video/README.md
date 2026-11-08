# Release video (short form, 9:16, 91 s)

`release.js` is the whole video: 17 shots of 5 s, each with a header naming what is on screen and one
live readout, then a 6 s end card. No sound (voice-over goes on top).

To render: copy `launcher/web` to a scratch folder, add `logo.png` (the Primary Compact OnDark PNG
from the brand kit) and append after `app.js` in its index.html:

    <script src="https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.min.js"></script><script src="release.js"></script>

Serve it with a server that saves PUT bodies into `out/` (the beta promo's `save_server.py`), open it
in a browser, then `await VID.init(); await VID.render()` from a script injected into the page.
Writes `out/release.mp4` in about 40 s. `VID.still(t, name)` writes one frame for checking.

## v2: filmed from the real app

`cap.js` (Playwright, `npm i playwright@1.49.1` and `npx playwright install chromium`) films the real
app for every feature shot: it sets each control and fires its own input/change event, draws a frame,
and saves the 3D stage and the panel rows to `cap/<shot>/` (s_ and p_ frames plus meta.json with the
row rectangles and the slider position for the cursor). Serve the render copy on port 8770 first, then
`node cap.js run` (about 12 min; `node cap.js probe` makes one still per shot for framing). release.js
then lays each shot out as the app view on top and a card of its real panel rows below, with a drawn
cursor on the moving control; only the title and end card are rendered. Assembly takes about 14 min.
