Status: ready; row FU-1 done (the PR that adds this file), rows FU-2 to FU-4 open

# Amendment: follow-ups after the picture, sound and audit rounds

> **Owner decision of 2026-11-17 (in chat, translated):** "I approve the new pictures. Then do the two suggested next items (the picture touch-ups and the check for missed recordings) one after the other and merge them. Also review whether the whole service runs smoothly and quickly on every page, and fix what needs fixing."
>
> Follows `AMENDMENTS-PICTURES-2026-11.md`, `AMENDMENTS-QUEST-SOUND-BACK.md` and `AMENDMENTS-AUDIT-2026-11.md`. Every change is marked **[FU]** where it lands.

**Standing rules that apply here**

- Anti-shame rules, tokens only, UI strings through `packages/i18n` in en, es and ko, one commit per intent with its test.
- A budget line is raised only to a measured number, recorded where the line lives.

## Rows

**FU-1 The owner approves the 18 new glyphs.**
The 18 glyphs of PX-1 (`food-rice`, `food-kimchi`, `food-kimbap`, `animal-tiger`, `school-book`, `nature-mountain`, `nature-sea`, `nature-moon`, `culture-hanbok`, `culture-seollal`, `culture-chuseok`, `culture-yutnori`, `culture-gayageum`, `food-egg`, `food-tteok`, `science-shadow`, `science-seed`, `nature-cloud`) move from `review` to `approved` in the WordArt registry.

**FU-2 Picture touch-ups.**
(a) The pictures the PX rows left weakest: `science-seed` (reads as a chestnut), `culture-gayageum` (strings merge at 54 px), `culture-seollal` (small at 48 px), `food-kimbap` and `nature-sea` (silhouette is a block), and the cards `insa`, `jirisan`, `ssireum`, `seollal`, `yutnori`; in the scenes, the six-arm snowflakes, the yangban mask and the glow burst. (b) The story props the review did not reach (about 110 past the 40 most used), triaged on the same five questions and fixed where the verdict is tweak or redraw. Rules R1 to R6 apply. A glyph that is redrawn goes back to `review` only if what it shows changes; a sharpened outline or a larger detail keeps `approved`.

**FU-3 Every Korean sound plays the recording when one exists.**
Audit every place that speaks Korean (a speaker button, an automatic prompt, an answer's sound) and list, for each, whether it asks for the recorded clip first. AU-13 found one screen (Build a Letter) that went straight to the device voice although a clip existed. Each place that skips an existing clip is changed to the order of F-AUDIO-004 decision AD4 (clip, then voice, then text), with a test. The list is recorded in As built.

**FU-4 Every page opens and moves quickly.**
Measure, on the release builds of the learner app and the site, for the main pages and flows (first open cold and warm, Home, Journey, a lesson page, a quest and each game family, Library and a card, Words, Stories and the reader, Results, the grown-up area, the console's main pages, the site's landing and policy pages): load time, main-thread blocking, JavaScript transferred, layout shift, the time a tap takes to show its next screen, and long tasks during play. Record the numbers before and after. Fix what is found to be slow where the fix is local and safe (code that does not need to load at first, work done on every render, repeated storage reads, oversized assets, missing caching). Larger changes are listed with numbers, not made. The start bundle line goes down when the start bundle does.

## Not in this amendment

- The items that wait for an owner or counsel decision (`AMENDMENTS-AUDIT-2026-11.md`, "Not in this amendment").
- A non-colour mark for the active tab (needs a design pass first).

## As built

**FU-1.** `packages/design-system/src/word-art/registry.ts`: the PX-1 line sets `approved`; the tests that held the earlier `review` state of `nature-cloud`, `food-egg` and `food-tteok` (`registry.test.ts`) and of the 18 (`registry-px1.test.ts`) now expect `approved`. Nothing at runtime reads the status; the contact sheet shows it.

**FU-2.** Every item was drawn by the real components (WordArt `glyphToSvgString`, `HeritageCardArt` / `UpperCellCardArt`, scene-art `drawScene` / `drawProp`) on before and after contact sheets at 160, 96, 64, 54 and 48 px with a silhouette for glyphs, 200, 64 and 54 px for cards, and 200x150 and 64x48 (plus the story scenes at 380 and 120 px) for props, and redrawn until it read as what it is.

- **(a) Glyphs** (`word-art/glyphs/*.ts`, pins in `registry-fu2.test.ts`, counts in `registry-px1.test.ts`): `science-seed` is four pointed teardrop seeds in golden tan, the big one split at its tip with a stem and two leaves (the round brown seed read as a chestnut); `culture-gayageum` has three strings 8 units apart over bigger bridges (four merged at 54 px); `culture-seollal` is the bow folded over the knees, drawn about 16 % larger to fill the tile, without the lucky pouch that floated above it; `food-kimbap` is the roll above two slices that stand apart (the silhouette was one block); `nature-sea` is one wave curling over at its crest above a band of water, with the sun (three flat bands were a block). **Status:** all five stay `approved`. None changes what it shows (seeds with one sprouting, the zither with a bridge per string, the New Year bow, cut kimbap, the sea's waves); the pouch was a supporting thing the row itself asked to drop ("fewer elements"). The WordArt source is 158,239 B raw / 47,185 B gzip, within 160 / 48 KB. `design/brief/illustrations/word-art.md` describes the five, marked **[FU]**.
- **(a) Cards** (pins in `stage1-art.test.ts` and `upper-art.test.ts`, briefs in `heritage-card-art.md` marked **[FU]**): `ssireum` is two wrestlers crouched in the hold (a shared `Wrestler`: legs bent wide, heads on each other's shoulder, white satba at waist and thigh, each hand on the other's thigh band; two friends leaning in read as a hug); `insa` is drawn a tenth larger without the motion arcs; `jirisan`'s front peak rises out of a second cloud band and its summit stone is an angular rock (a straight-sided slab read as a chimney); `seollal`'s child is larger and now faces the grandparent: it had its back to her, which is wrong for a bow, so it is mirrored, and the pouch is left out to make room; `yutnori` has the board at the top and the sticks in two pairs below it, none over the board. Budgets (`card-ids.test.ts`): `UpperCellArt.tsx` measures 40,775 B, line 38,600 to 40,800 B; the legendary frames with `Wrestler` 3,514 B, line 3,200 to 3,550 B; per-drawing lines unchanged. `HeritageCardArt.tsx` 39,654 B, within 40,000 B.
- **(a) Scene things** (pins in `scene-art/__tests__/fu2-things.test.ts`): the four-season scene's two six-armed snowflakes are larger with a pair of branches on every arm (the scene passes the hidden-heritage profile; chunk 23,209 B of 25,000 B); `prop:glow-burst` has no halo disc (it read as a pale sun), twelve rays long and short in turn and four bigger glints round the empty centre; `prop:fig-yangban-mask` has a larger mask (12 by 13) with its ink slit eyes and jaw line bolder.
- **(b) The rest of the story props.** The registry holds 136 props; less the 40 of the first review, 96 were triaged (`docs/design/picture-review-2026-11/triage.md` section 8): keep 76, tweak 20, redraw 0, every tweak done (pins in `fu2-props.test.ts`). Eleven pale things on a cream ground get an ink outline from their own palette (papers-loose, paper-stack, fig-carver, fig-wrestlers, rabbit, fig-pansori, silk-bolts, books-airing, gourds, ceremony-goods, temple-site); eleven get the cue they lacked, two of them also outlined (paper-stack offset sheets, magpie's white belly, drum's stick and rimmed head, cabbages' green leaf tops, craft-wood's plane and curled shavings, gourds' vine leaves, gomusin shoes in side view, taffy sticks on a shallow tray, yut sticks with round ends and X marks, the bojagi knots in the book chest, the rice stalks bowing under their ears). No story JSON changed. Every story scene that draws a changed prop stays within 8 colours (`story-art.test.ts`); the cabbages' two whole heads became two shapes so the gimjang scene's focus does not blend into its green ground. Scene registry 213,763 B of 210 KB.
- **App start bundle:** the release `build:web` (CI=1) measures 4,966,989 B raw (4,965,473 B at PX-4), under the 4,969,500 B line, which does not move.
- Still weakest in the reviewer's eye: `culture-seollal` is larger but still a low, wide figure at 48 px; the shoes (gomusin are boat-shaped by nature); books-airing is small at 64 x 48 (a wide prop); the zodiac ring's faces are small (kept: the ring and the gold tiger carry it).
