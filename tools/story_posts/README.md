# Story posts (1080x1920 PNG)

`stories.js` renders four story posts from the lab's own 3D: roll center adjustments, wheel offset, radius rod
adjustments, front steering geometry. Title, part callouts (one row, ordered like their points so leaders never
cross), Short Track CAD logo + LINK IN BIO. Grounds alternate black / bone / orange; on orange the highlighted
parts go bone and the logo one-colour black.

Render in the same scratch copy as the roll center video (rollcenter_video/README.md) with `logo_dark.png` and
`logo_black.png` (Primary Compact OnDark / Black from the brand kit) beside index.html and stories.js appended:
`await STORY.init(); for (let i = 0; i < 4; i++) await STORY.render(i)` -> out/story_*.png.
