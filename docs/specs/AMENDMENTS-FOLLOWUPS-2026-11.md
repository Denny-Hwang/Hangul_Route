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
