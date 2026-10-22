# Grown-up lock (design mock v1, drawn as A-4a built it)

Wireframe: `design/wireframes/shell/grown-up-lock.md` (Panels A, B) · spec §3.9, §3.16, §3.17 · code: `apps/web/src/components/console/GrownUpLock.tsx` (A-4a, #387, merged) · mock: `mock/lock.html`, `mock/lock-states.html` · shots: `shots/lock-375.png`, `lock-1280.png`, `lock-states-375.png`, `lock-states-1280.png`

The lock shipped before this pass; it is drawn here so the shell's grown-up surfaces sit on one board and A-4b / A-5a match it. **No change is proposed.**

```
 [< Back to learning]                 quiet, top left -> learnerHome()
 +----------------------------------+
 |            [lock 48]              |  text.secondary
 |         Grown-ups only            |  h1, size.title, focus moves here (tabindex -1, no ring)
 |  Enter this device's grown-up     |  text.secondary, leading.relaxed
 |  PIN, or sign in again.           |
 |  [[ Use the grown-up PIN ]]       |  primary, max 400 (layout.pane.master); only with the PIN path
 |  [  Sign in again        ]        |  secondary; becomes the primary when there is no PIN path
 +----------------------------------+  surface.paper, radii.lg, padding spacing.xxl spacing.lg
```

| Panel | Line (`console.lock.*`) | Buttons |
|---|---|---|
| A · `pin`, trusted epoch | `line` | Use the grown-up PIN, Sign in again |
| B · PIN changed | `pinChanged` | Sign in again |
| B · no trusted epoch here | `firstSignIn` | Sign in again |
| B · epoch 0 | `pinRenew` | Sign in again |
| B · `nopin` | `noPin` | Sign in again |
| B · marker absent with profiles, failed or slow read | `signInOnly` | Sign in again |

- No frame, no persona, no name, no number, no countdown; the same single column at every width.
- While it decides, the page is an empty canvas (README, D12); a back/forward-cache restore covers the page with an opaque `surface.canvas` cover first.
- Shared with `/signin`: the quiet Back to learning, the 400 px button column and the paper card (Panel D of `signin.md` reuses this card).

**[OA] Use a passkey** (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.4, row OA-3): a secondary button under the last button of the card, only where the browser offers a platform authenticator and the marker is read and is not `pin` (in practice `nopin`; hidden on a failed read and on a missing marker with profiles). Drawn in `design/screens/profiles/console-pin.md` (boards 1 to 3); everything above stays as drawn here.
