# Native grown-up homes, the space and school pages, the code panel and the plan block (screen spec, NS-0b)

Spec: F-AUTH-004 sections 8.1 to 8.6, 8.8, 9.1, 14, 17.3, 17.4 · wireframe `design/wireframes/account/native-homes.md` (Panels A to D, F, G) · mocks `mock/homes.html` (boards 1 to 19), `mock/plan-block.html` (boards 1 to 9), `mock/tablet.html` (boards 1, 2), es and ko on `mock/lengths.html` rows 23 to 30, Largest `mock/largest.html` boards 2 and 6 · shots `shots/homes-*.png`, `plan-block-*.png`, `tablet-*.png` · rows NS-5, NS-6

## Common frame

- `ScreenHeader`: Back, the title, Display. A home's title is the label of its use (`learner.who.use.family` / `.teacher` / `.school`, or `caregiver.account.card.title` for `account`), the row the grown-up pressed; a space or school page is titled with the space's name (D13).
- `surface.canvas`, `layout.gutter`, `spacing.lg` between blocks; `layout.maxWidth.reading` on a phone, `layout.maxWidth.full` on a wide window (`tablet.html`).
- **The end of every home** (`home-end`): a `border.subtle` rule, the quiet line `caregiver.account.home.moreTools` (`size.bodySm`, `text.secondary`, no link, no place), then **Sign out** (paper, the Sign out ConfirmSheet of `lock.md`). Not drawn on `unavailable` (board 18), which keeps only Back.

## Family home (boards 1 to 7, 19)

1. Once after a re-trust: the info strip `home.retrustNotice` (`feedback.infoLight`, `feedback.info` edge, polite status), no button (board 2).
2. One section per family (live in creation order, then archived): the family name (`size.prompt` bold, a grown-up's own words), `console.home.archived` after it on an archived family.
3. Learner cards in join order (`logic/account/order.ts`), one column on a phone, two across from 18rem (`acc-card-min`): the name (`size.bodyLg` bold), `console.space.learner.lastActive(describeRelativeDay(…))` or `console.parentHome.lastActive.notStarted`, `console.parentHome.minutes7d(n)` (both `size.bodySm`, `text.secondary`), **See report** (paper, full width) (D10). No avatar: the server has no device avatar, and a chip colour would be a second cue for nothing.
4. The code panel (below), or **Make a code** for a manager with no live code (board 3), or `console.parentHome.askOwner` for anyone else; an archived family shows none.
5. The plan block (below) when the family has a status card.
6. A family with no learner: `console.parentHome.empty.title` and the code panel (board 6). No family: `home.noFamily` and the home end (board 7).
7. One family refused (`403` / `404`): its section keeps its name and shows `home.cantLoad` with **Try again**; the others stay (board 19).

## The code panel (D11)

A paper card: the label `home.codeLabel.family` / `.class` (`size.bodySm` bold, `text.secondary`), the code in `family.mono` at `size.display` bold with tracking, centred, drawn in two groups of three that never break inside a group (`K7M PQ4`; the six characters themselves are the code, the space is drawing only) and wrap at the space between them; if one group still does not fit (Largest on a narrow phone), the text steps down (`adjustsFontSizeToFit`, `minimumFontScale` = body / display) and never below `size.body` (spec 14). Under it **Copy** (`console.joinCode.copy.cta`) and **Join on this device** (`home.joinHere`), paper buttons side by side that wrap to two rows. After a copy the button reads **Copied** (`console.joinCode.copied.cta`) as a polite status for about 2 seconds (board 4); a refused copy shows the info strip `console.parentHome.copyFailed` under the code (board 5). Accessible: the panel is a group named by its label; the code is read as `a11y.account.joinCode(code)` with the six characters, the drawn groups hidden.

## Teacher home and School (boards 8 to 11)

- Group heading **Classes** (`console.kind.group.class`, `size.body` bold, `text.secondary`), then one row per class (live in creation order, archived after with `surface.sunken` and the archived word). A row's top is one pressable (name bold, `console.spaceCounts.students(n)` from `counts.learners`, the attention line `console.home.attention(n)` as plain text when the item carries attention counts, a chevron) that opens `AccountSpace`; **Class report** (`console.home.classReport`, paper) is its own button under it, never nested in the pressable.
- Group heading **School** (`console.kind.group.school`), then one row per school: owner or admin, a pressable with a chevron to `AccountSchool`; a teacher member, plain text with no chevron and no press (board 8).
- Two rows across from `layout.breakpoint.wide`, measured on the screen (`tablet.html` board 2).
- School use (board 9): the same page titled **School**, accessibility focus on the first school row (drawn with the focus ring). A stale record (no school any more): the info strip `home.noSchool` above the Teacher home (board 10). No class and no school: `home.noClass` and the home end (board 11).

## Space and school pages (boards 12 to 14)

- `AccountSpace` for a class: **Class report** (paper) at the top (D13), the roster in join order (one paper list, rows at least `touchTarget.min`: the name semibold and **See report**), the class code panel when the roster carries `joinCode`, the plan block when a status card exists. A teacher whose roster carries no code sees no panel and no line (board 13).
- `AccountSchool` (owner, admin): group heading **Classes** with its class rows (a refused class: plain text with `home.cantLoad`), `home.teachers(n)`, the plan block with its usage line (board 14).

## The plan block (`plan-block.html`, D9)

A `surface.sunken` box with `radii.md`, no border and no chevron: the plan line (`text.primary` semibold) and, when `usage` is present, the usage line (`size.bodySm`, `text.secondary`). Rows: `free` and own `expired` → `console.billing.coverage.free`; own `active`, `trial`, `past_due`, `cancelled` → `.family`, `.license` or `.contract` (the status is never shown); school → `.schoolUntil(name, date)` or `.school(name)`; usage → `console.billing.usage.learners` / `.students` / `.teachers`. No card, no block (board 9). One accessible element: `accessibilityLabel` = `a11y.account.planBlock`, `accessibilityValue.text` = the visible lines in order, role text, never a button (web mock: a group labelled by `planBlock`).

## States (boards 15 to 19)

Loading: two skeleton cards (`surface.sunken` bars in a paper card; hidden from assistive tech; the header title is real). Offline: a paper state box with `home.offline` and **Try again**; reloads by itself on reconnect. Error online: `home.cantLoad` and **Try again**. `403 native_off`: `home.unavailable` and **Back** only. `401`: no screen of its own; the records are deleted and SignIn opens after the gate.

## Accessibility

- Reading order: header, the notice, each space section (name, cards or rows, code panel, plan block), the quiet line, Sign out (spec 14).
- Every control at least `touchTarget.min`; names and codes never truncate from Standard to Largest; no sideways scroll at 320 with 200 % text.
- No status by colour alone (archived is a word; attention is a sentence); no danger colour on any home.
