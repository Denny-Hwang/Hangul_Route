# Learner app: the Classes & family card with moves (design mock v1, for T-7b)

Wireframe: `design/wireframes/console/class-transfer.md` screen 4 · spec 4.12 (row variants, Classes card), 4.2 guards 8, 10, 11 · code: `apps/mobile/src/components/SpacesCard.tsx` · mock: `mock/classes-card.html` · shots: `shots/classes-card-375.png`, `-1280.png`

The card is today's `SpacesCard` (title `caregiver.spaces.title`, rows with name, kind caption and **Leave**, then **Join a class**). Moves add at most one button per class row and at most one line or pending row under the rows. **Nothing new renders while the inbox says `transfersEnabled: false`.** The variant is chosen from the inbox (`learnerRoute`, device scope, `transfers[]`) before any tap, so a PIN is never asked for a dead end.

## Variants

| Variant | When | Row buttons | Under the rows |
|---|---|---|---|
| (a) class tablet | device `scope: 'class'` (inbox `transfers: []`) | **Leave** | "Use your grown-up's rescue code first." (once per card) |
| (b) family account | `learnerRoute: 'caregiver'` | **Leave** | with an open request: the pending row (read-only sentence, gated **Review**) and "Ask the grown-up with the account to answer this in the console." With none: nothing |
| (c) this device answers | `learnerRoute: 'device'` (device consent on; no family account, or `selfManaged`) | **Move** (gated) and **Leave** | with a learner-started request that needs this device again: "Asked: a move to {Destination}." and **Review** (gated, primary) |
| (d) nobody yet | `learnerRoute: 'none'` | **Leave** | "A grown-up needs to set up a PIN first. Open Profile, then Grown-ups." and **Set up PIN** (opens `PinEntry` in `mode: 'setup'`; the device route opens 24 hours after the PIN is made) |

- **Planned (cooling-off), any full-scope variant**: "A move is planned for {date}." with a gated **Cancel** (any device of the learner can veto).
- **The veto in (b).** Guard 11 lets the learner's full-scope device decline or cancel any open request. In (b) the card therefore keeps one gated **Review** on the pending row; it opens the read-only sheet whose only action is **Not now** (`app-sheets.md`). The quiet line says where the yes happens. This is the reading of "(b) ... no PIN prompt" that keeps the veto reachable: no PIN is asked for an answer the device cannot give.
- **Gate mark.** A button behind the grown-up gate carries the `lock` glyph (16 px, the label's colour) before its label, and its accessible name ends with "(PIN required)" (`caregiver.gated`). On a self-only device with no PIN the gate opens directly (`gate-route.ts`), so the glyph is not drawn.
- **Leave** keeps its confirm dialog; a failure now shows `caregiver.retry.offline` ("This needs internet. Try again when you are online.") under the rows instead of nothing (the small `SpacesCard.tsx:36` fix).
- **Offline**: Move is disabled with the same line as its description; nothing is queued.
- **After the move**, a class tablet of the old class gets 401 on its next inbox call: its memberships clear and the card says "Join your new class again." (`role="status"`).
- "Waiting for the family." (spec 4.12 (d)) is **not drawn**: with the device route off or absent, a request whose learner side is the web route always has a family account, which is variant (b) and its own line. T-7b adds it only if a reachable state appears.

## Tokens

| Part | Tokens |
|---|---|
| Card | design-system `Card` (`surface.paper`, `radii.lg`, `shadows.card`, padding `spacing.lg`) |
| Row | name `Body` semibold, kind `Caption` `text.muted`; buttons `Button` ghost `sm` (64 px), `spacing.sm` apart |
| Quiet line | `size.bodySm` `text.secondary`, `leading.relaxed` |
| Pending row | `surface.sunken`, `radii.md`, padding `spacing.sm` `spacing.md`; Review primary (asks this device) or ghost (read-only, veto) |
| Lock glyph | `Icon name="lock"` 16, `brand.primary` on ghost, `text.onPrimary` on primary |

## Accessibility

Each Move button names its class ("Move from Sunday Class A (PIN required)"), like Leave does (`a11y.leaveSpace`). All buttons are at least 64 x 64; rows wrap their buttons under the name when the width is short and never scroll sideways.
