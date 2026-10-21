# Minigame/Hidden Heritage — find the named things in a large heritage scene, and the scene style guide (wireframe v1)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §7.1 F7 (kind `hidden-heritage`, Stages 2-5, fallback Pic-Word Match on the same targets), OD-10 (original token-coloured scenes about genre-painting subjects, with source facts on the card back), §7.7 (anti-shame), §10 (lazy chunks), §12.2 (`game.hidden-heritage` off), §13 (art cost and size), §14 (48 dp targets in the new games) · blueprint 06 game ⑩ (Hidden Heritage, the signature game) · extends `minigame/shell.md`, `minigame/families.md` (Family Discovery) and `minigame/pic-word-match.md` (the fallback, and the pattern for misses and the "look here" ring) · drawn with the scene-art kit of `design/brief/illustrations/scene-art-style.md` (F-STORY-002 §3.9) · lecture slide: `classroom/lecture-big-screen-v2.md`
Audience: **any learner, any age** (CLAUDE.md §1); the same screen for everyone. Reading and listening only: nothing on this screen asks the learner to speak or records sound.
Code (row CM-36): `apps/mobile/src/screens/minigames/HiddenHeritageGame.tsx`; pure rules in `apps/mobile/src/logic/hidden-heritage-flow.ts` (hit test, first-try scoring, hint); the scene drawn by `StoryScene`'s renderer (`packages/design-system/src/scene-art/`); budget and composition checks beside `scene-art/rules.ts`. Scenes: CM-36 (Food) and CM-37 ×4 (Letters, Holidays, Nature, Play).
Mock: `design/screens/journey-topic-pages/` (`mock/hidden-heritage.html` and `mock/hidden-heritage-slide.html`; 320, 768 and the projector stage)
Notation: `[[ X ]]` the one primary action, `[ X ]` a button, `( x )` a text placeholder, `~~ x ~~` taught Korean with romanization (`KoreanText`), `{ x }` content-driven, `<x>` a runtime state.

## Scenario (Given-When-Then)

Given: a Stage 2-5 practice or apply step with a `hidden-heritage` scope (one scene and 3-5 Korean target words)
When: Hoya names one thing in Korean (written with romanization, and heard), and the learner looks for it in the scene and taps it
Then: a right tap rings the thing, plays its word and shows its meaning, then the next word comes; a tap on another thing is a soft amber nudge that ends nothing; after two misses the right place gets a "look here" ring; when every word is found the step is complete

## Screen goal

"Find the thing Hoya names. A miss only means look again."

## Box diagram — A. a round at 320 x 568

```
+----------------------------------+
| (progress bar)   (1 / 3)  [Skip] |  <- shell header; Skip after the first answer
|                                  |
| (Find this)                      |  <- caption
| +------------------------------+ |
| |  ~~ 밥 ~~           [ (spk) ] | |  <- the target: Korean in KoreanText, romanization under it,
| |  (bap)                        | |     and a Hear button; never an English label
| +------------------------------+ |
| +------------------------------+ |
| |                              | |
| |   { scene, 4:3, the full     | |  <- 288 x 216 dp at 320 px; spots are invisible buttons
| |     content width }          | |     over drawn things (targets and other things)
| |                              | |
| +------------------------------+ |
| (Found)  [ok 국  ] [ ... ] [ ... ]|  <- one slot per target; a found word fills its slot
|          [  guk  ]                |     with KoreanText: the word and its romanization under it
|                                  |
| (Hoya thinking: "Look again")    |  <- only after a miss
+----------------------------------+
```

States of one word:

```
ask:       the word shows and plays once (device voice); the Hear button plays it again
right:     a ring (feedback.success, borderWidth.thick) around the spot stays; the word plays;
           the meaning in the UI language appears under the word ("soup"); after 0.7 s the next word
miss:      the tapped spot gets an amber ring (feedback.nudge, with its text.primary casing) for 0.6 s, then clears; Hoya thinking,
           "Look again"; the word stays; nothing ends
2nd miss:  the right spot gets a "look here" ring (feedback.info, dashed, inside the spot) that stays until it is found
background tap (no spot): nothing happens and nothing is scored
done:      every word found -> the end panel (below), then back to the quest
```

## Box diagram — B. the end of a scene

```
| (You found them all)             |
| { the scene with every found ring }
| ~~ 밥 ~~ (bap)        rice       |  <- each target: Korean, romanization, meaning in the UI language
| ~~ 국 ~~ (guk)        soup       |
| ~~ 숟가락 ~~ (sutgarak) spoon     |
| [[ Continue ]]                   |  <- back to the quest player
```

## Box diagram — C. 768 x 1024 (regular)

```
+--------------------------------------------------------------+
| (progress bar)                       (1 / 3)          [Skip] |
| (Find this)   ~~ 밥 ~~ (bap)           [ (spk) Hear ]          |  <- the prompt on one row
| +----------------------------------------------------------+ |
| |                                                          | |
| |   { scene, 4:3, up to layout.maxWidth.reading (720) }    | |  <- 720 x 540 dp: spots 135 dp or larger
| |                                                          | |
| +----------------------------------------------------------+ |
| (Found)  [ok 국 / guk ] [  ] [  ]                            |  <- each found slot: KoreanText, word over romanization
+--------------------------------------------------------------+
```

- **Landscape phone** (`short`): the prompt and the found slots in a column beside the scene; the scene takes the height (F-LAYOUT-001 `sideBySide`).
- **Smallest scene: 256 dp wide** (75 units = 48 dp at 256). The scene is never drawn narrower. When the beside layout would leave it under 256 dp (a short or split-screen window), the prompt column moves under the scene and the scene takes the full content width; when even the full content width is under 256 dp, the step renders the Pic-Word Match fallback ("States"). Row CM-36's layout test covers 320 x 568, 568 x 320 (landscape `short`) and a split-screen width under 256 dp.
- **Wide**: the scene stays within the reading width, centred; the quest player has no second pane.

## Box diagram — D. projector slide (lecture mode, the stage of `lecture-presenter.md` C)

```
+--------------------------------------------------------------------------+
| Find it together                                             (kind label) |
|                                                                          |
|  +-----------------------------------------+     ~~ 밥 ~~                  |  <- b0: the scene and the word
|  |                                         |     bap                      |
|  |   { scene, 4:3, 720 x 540 units }       |     -----------------        |
|  |                                         |     rice                     |  <- b1: the meaning
|  |                                         |                              |
|  +-----------------------------------------+     (b2: the ring on the spot)|
+--------------------------------------------------------------------------+
  control bar (docked): [ < ] [ > ] [ (spk) Sound ] ...                       <- the presenter's own bar
```

- Builds: **b0** the scene and the Korean word with romanization; **b1** the meaning; **b2** the found ring on the target spot. `next` moves b0 → b1 → b2 → the next word (b0 of word 2). The class looks and points; the teacher clicks on. Nobody's name or score is on the stage, and nothing is scored (lecture slides never score).
- The Sound control plays the word (device voice, the presenter's existing notice when there is none).
- `Shift+R` follows the presenter's romanization setting, as every slide does.
- One slide per target word, so a scene of 3 targets is 3 slides; the deck builder adds them from a `hidden-heritage` round (row CM-36: "slide kind").

## Interaction points

- **Spot** (a hit area over a drawn thing): tap → right or miss, as above. Only taps on spots are answers. The first tap on a spot for a word scores that word (`first-try.ts`, key `w<n>`); later taps are retries.
- **[ (spk) ]**: plays the word again. **[ Skip ]** (shell): ends the step without marking unfound words.
- **Keyboard (web)**: Tab moves through the spots in reading order (left to right, top to bottom); Enter or Space taps. The focused spot draws the keyboard focus indicator: a **solid** `border.focus` outline at `borderWidth.thick`, **outside** the hit area (offset `spacing.xxs`). The look-here ring is **dashed**, in `feedback.info`, **inside** the spot, so focus and the hint never look alike. Every thing in the scene has a spot (targets and other things alike), so tabbing shows where things are, never which one is the answer, and focus never marks a target before its hint.
- No drag, no pinch, no timer, no gesture that only a pointer can do.

## Navigation graph

Enter from: `quest/player` (a practice or apply step with a `hidden-heritage` scope) → `minigame/shell` (push, returns) · lecture: the presenter's deck
Exit: the end panel's Continue or Skip → back to `quest/player` (step complete) · empty scope → back to `quest/player`

## States

- **success**: A, B.
- **empty**: a scope with fewer than three playable targets shows "(Nothing to play here)" and [ Back to quest ] (the shell's empty state).
- **switched off** (`game.hidden-heritage` off, §12.2): the step renders its fallback, a **Pic-Word Match** board on the same targets, so no quest is blocked.
- **scene not loaded** (the lazy chunk is missing offline, or unreadable): the step renders the same Pic-Word Match fallback, never an error box. Scenes are precached with the lesson bodies (§10), so offline play works after the first open.
- **The fallback never reads the scene chunk.** Its pictures are each target's own `PictureRef` (`word:<key>` WordArt or `card:<id>` card art, drawn by `PictureArt`, all in the design system's bundled SVG), the same pictures a Pic-Word Match step of that lesson draws; a target with no picture gets `PictureArt`'s plain gloss tile, never a blank tile. The scene's props live in the chunk that may be missing, so they are never the fallback's pictures. Row CM-36 makes `picture` a required field of each target (a `PictureRef`) and adds a test that renders every `hidden-heritage` step with its scene chunk absent and no network, and expects a playable Pic-Word Match board.
- **no device voice**: the visible sound notice of F-AUDIO-004; the written word with romanization carries the round, and nothing is lost.
- **reduced motion**: no motion is used; rings appear and clear without fading.
- **large text (200 %)**: the prompt and the found slots grow and wrap; the scene keeps its width, so the spots keep their size.
- **found slots**: each found slot is `KoreanText`, the word with its romanization under it (two lines; CLAUDE.md §1: taught Korean always shows romanization), following `romanizationMode` like the prompt. At 320 px the slots wrap to a second row with 4-5 targets. An empty slot is read as "Not found yet".

## Accessibility

- The scene is an image named by its `altEn` (in the UI locale), which describes the setting, never the things to find: "A food stall on a market day." The things are named only on their spots.
- Each spot is a button in reading order. Its name is the thing's **meaning in the UI language** (the same rule as Pic-Word Match's picture tiles), and, once found, its state: "soup, found" (`a11y.hiddenHeritage.spotFound`).
- **Korean UI.** In the ko UI the meaning comes from the ko overlay gloss (F-I18N-001 overlays) when it differs from the target word (a Korean paraphrase). When the ko gloss is the target word itself (밥 for 밥), the spot is named by that gloss as given, and the found line, the live region and the end panel leave the meaning out ("Found: 밥" is not said twice; the end panel shows 밥 (bap) with no third column). This is the same as Pic-Word Match in the ko UI, recorded as accepted parity: a ko-UI screen-reader learner matches the word by sound and spelling, not by meaning. The open question below tracks whether a picture description should replace it. So a screen-reader user hears the Korean word and picks the thing whose name means it: the same meaning match, without the visual search. Every scene has at least as many other things (spots that are not targets) as targets, so the list never gives the answer away.
- The target word is `KoreanText` (speech language `ko`, its romanization read too) with the Hear button beside it; the live region says "Found: soup" after a right tap and "Look again" after a miss.
- Spots are at least 75 canvas units on each side (below), never overlap and keep at least 11 units (8 dp at 320 px) apart.

## Data needs

- reads: `scopeFor(ref).hiddenHeritage` (`{ sceneId, targets: [{ id, word: KoText, spot, picture: PictureRef }] }`, row CM-36; `picture` is the fallback's bundled picture) · the scene chunk (`content/scenes/<id>.json`, lazy and precached) · `romanizationMode` · the word's gloss in the UI locale (lesson items, F-I18N-001 overlays)
- writes: `host.answer('w<n>', correct)` → `quest-run-store`; `host.complete()`; review items for each target word (`memoryRecord`, §4.2) through the shell like any round
- telemetry: `minigame.finished { kind: 'hidden-heritage', questId, stepIndex }` (existing, from `MinigameScreen`); no tap coordinates are ever sent

## Proposed copy (row CM-36 lands the strings with es and ko)

| Intended key | English |
|---|---|
| `learner.hiddenHeritage.prompt` | Find this |
| `learner.hiddenHeritage.found` | Found |
| `learner.hiddenHeritage.again` | Look again |
| `learner.hiddenHeritage.allFound` | You found them all |
| `a11y.hiddenHeritage.foundLive(gloss)` | Found: {gloss} |
| `a11y.hiddenHeritage.spotFound(gloss)` | {gloss}, found |
| `a11y.hiddenHeritage.slotEmpty` | Not found yet |
| `lecture.slide.hiddenHeritage.kind` | Find it together |

- Reused: the shell's Skip, Continue, the Hear button's name and the empty state.
- Count: 8 new strings, each in en, es and ko (spec §17, row CM-36, "about 8").

---

## Scene style guide (OD-10)

A Hidden Heritage scene is a **scene-art description** (`design/brief/illustrations/scene-art-style.md`): a setting and layers of registry items, every colour a token path, drawn by the same renderer as story pictures. The rules below are that guide's rules, with the changes a find-the-thing scene needs. `checkScene` gains a `hidden-heritage` profile in row CM-36 that runs every numbered rule.

### 1. Subject: original scenes about what genre paintings show

- **Subjects.** Everyday Joseon life that genre painting (풍속화, pungsokhwa) shows: a market day, a village school room, a washing place by a stream, a threshing yard, a kitchen yard with sauce jars, a smithy, wrestling at a festival, a kite day. One scene, one place and one moment.
- **Original, never a copy.** A scene is composed fresh from the kit. It never copies, traces or closely follows the composition of a known painting: no same arrangement of figures, no same viewpoint and crop, no recognisable group lifted from one. The reviewer checks this against the painting the subject comes from (H-5).
- **Faceless people** (scene-art rule): a blank `surface.paper` oval with a `border.strong` outline; hats, hair and clothing carry who they are. No historical person, no named painter's figure, no invented likeness.
- **Facts on the card back.** The scene's subject facts (what the place or activity was, which public collection holds a genre painting of it) go on the scene's heritage card back with a source from the `culture-source` allowlist (§6.6): National Museum of Korea, National Folk Museum of Korea, Korea Heritage Service, and the others listed there. The scene itself carries no text and no caption claim.

### 2. Targets: Korean words

- 3-5 targets a scene, each a thing drawn as one registry item (a prop or a figure), named by a **Korean word the lesson teaches** (Stage 2: simple nouns; Stage 3: a noun with a describing word, "큰 항아리"; Stages 4-5: a person doing something, "씨름하는 사람"; blueprint 06 ⑩).
- The prompt is the Korean word, heard and written with romanization (`KoreanText`). **Never an English label**, in the prompt or anywhere in the picture. The meaning in the UI language appears only after the thing is found, and in the end panel.
- At least as many **other things** as targets get spots too (named by their meaning for screen readers), so tapping at random does not find the targets and the screen-reader list never gives the answer away.
- The first scene (row CM-36) is the Food Stage 2 Volume 2 **market scene** of §5.3, with targets from that cell's taught words (the table set 밥, 국, 반찬; spoon and chopsticks 숟가락, 젓가락). The mock draws it as a food stall on a market day with 밥, 국 and 숟가락 as targets and 반찬, a jar and a basket as the other things.
- Two targets in one scene never share a word or a look-alike item (two jars of different sizes are one target, "항아리", not two).

### 3. Hit areas

| Rule | Value | Why |
|---|---|---|
| H-1 size | each spot at least **75 x 75 canvas units** (a rectangle or a polygon whose inner square is that big), and the scene never drawn under 256 dp wide (75 units = 48 dp there; "Landscape phone" above) | the scene is 400 units wide and drawn at the full content width: 288 dp at 320 px, so 75 units = **54 dp** (above the 48 dp of §7.1 and §14); 343 dp at 375 px, so 75 units = **64 dp** (`touchTarget.min`); 720 dp at 768 px = 135 dp |
| H-2 gaps | spots never overlap and keep **11 units** apart (8 dp at 320 px) | a tap is never on two spots |
| H-3 covers the thing | a spot covers its drawn item's box (it may be larger, never smaller than the item) | a tap anywhere on the thing counts |
| H-4 edges | a spot lies inside the canvas | no target is cut by the frame |
| H-5 review | the reviewer taps every spot on the 320 contact sheet and confirms the composition is not a copy (rule 1) | |

- The 54 dp spot at 320 px is under `touchTarget.min`, like the Journey cells at 320 (F-LAYOUT-001 audit UX-25), but it is a new kind of target, so it gets **its own recorded exception**: a picture search cannot fit 64 dp spots into a 288 dp scene. Row CM-36 adds it to the touch-target allowlist with this reason, keyed by the scene's test id (never a blanket skip). From 375 px every spot meets `touchTarget.min`, and every spot clears the 48 dp of §7.1 and §14 at every width.

### 4. Composition and budget

| Rule | Hidden Heritage scene | Story scene (for comparison) |
|---|---|---|
| Canvas | 400 x 300 units, 4:3 | the same |
| Layers | up to **14** (a setting, 3-5 targets, 3-6 other things, 1-2 dressings) | up to 8 |
| Resolved shapes | up to **240** | up to 160 |
| Colours | up to **8** a scene, at least 2 from `surface.*` / `text.*`; Hoya's own palette not counted | the same |
| Focal point | **none**: the things are spread over the scene, at least one target in each half (left and right) | exactly one |
| Hoya | at most one, scale 0.5-0.8, never a target, never covering a spot | at most one |
| File | the scene's chunk (its description plus the props and setting it adds to the registry) **25 KB or less** raw, loaded lazily and precached with the lesson bodies (§10) | in the bundle |
| Text in the picture | none | none |
| Faces | Hoya calm or smiling; people faceless (rule 1) | the same |
| No violence or fear | as scene-art rule 10; a wrestling scene shows a friendly bout, nobody hurt | the same |
| Thumb | a found thing must still read at 54 dp (its item has at least 3 shapes after the thumb variant drops details) | at 96 px |

- **Contrast.** A target's main fill differs from what is behind it, and every target has an outline (`borderWidth.base`, `border.strong` or darker), so a thing never hides by colour alone. The scene is never a "where is it" puzzle by camouflage: things are findable, the word is what is learned.
- **Rings read on any fill.** The found ring (`feedback.success`), the miss ring (`feedback.nudge`) and the look-here ring (`feedback.info`, dashed) are drawn at `borderWidth.thick` with a `text.primary` casing of `borderWidth.thin` on both sides, so a ring stays visible on a gold, green or dark thing (`feedback.nudge` is the same colour as `theme.life`). The CM-36 `hidden-heritage` profile of `checkScene` draws each ring over each spot's main fill and fails when the casing is missing.
- **Ground first.** The setting (sky, wall or ground) uses `surface.*` tokens; the things use `theme.*`, `brand.*`, `hoya.*`, `rarity.*` and `vocab.*` tokens. Never `feedback.danger`, `surface.overlay`, `surface.inkScrim` (the scene-art types forbid them); never the `feedback.success`, `feedback.nudge`, `feedback.info` or `border.focus` tokens inside a scene, because the found ring, the miss ring, the look-here ring and the keyboard focus indicator use them.
- **Reuse.** Build from the registry first (jars, baskets, figures with tintable garments). New items for a scene follow the item rules (40 shapes, 3 KB, 5 colours), carry `sourceRef` and `accuracyNote` when they show a real object, and are reviewed on the contact sheet.

### 5. Review checklist (pasted into every scene PR, CM-36 and CM-37)

- [ ] Subject is everyday Joseon life that genre painting shows; the source for the card-back facts is on the allowlist
- [ ] Composition is original: not a copy or tracing of a known painting (checked side by side)
- [ ] 3-5 targets, each a taught Korean word with romanization; no English anywhere in the scene
- [ ] Other things at least as many as targets, each with a meaning for its screen-reader name
- [ ] Every spot at least 75 x 75 units, 11 apart, inside the canvas; tapped on the 320 contact sheet
- [ ] Colours: tokens only, 8 or fewer, no `feedback.*` or `border.focus` tokens; every target outlined
- [ ] The found, miss and look-here rings, with their casing, are visible on every spot (checked on the contact sheet)
- [ ] Faceless people, Hoya calm or smiling, no violence or fear
- [ ] Budget: 14 layers, 240 shapes, chunk 25 KB or less (`budget.test.ts`)
- [ ] Fallback renders: the Pic-Word Match board on the same targets, from each target's bundled `picture` (`PictureRef`), with the scene chunk absent and no network
- [ ] Alt text: one sentence, 140 characters or fewer, no Hangul, never "Image of"; it names the setting, never the targets

## Open questions

- **Bigger scenes on a phone.** A scene wider than the screen (pan and zoom) would allow more and smaller things, but it adds a gesture and a second way to get lost. Default: one 4:3 scene that fits the width; more things means a second scene.
- **Korean UI spot names.** When the ko gloss is the word itself, a screen-reader learner matches by sound and spelling ("Korean UI" above). Default: parity with Pic-Word Match; CM-36 asks MAR whether a short ko picture description (for example "밥그릇") reads better, and records the answer.
- **Stage 3-5 targets that are phrases** ("씨름하는 사람") need a figure doing the action; the first scenes (CM-36 Food, CM-37) stay with nouns and noun phrases until a phrase target is tried on the contact sheet.
