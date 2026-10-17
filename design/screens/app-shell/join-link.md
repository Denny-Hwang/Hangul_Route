# Roster: the class join link and its QR code (screen spec, row OR-UX)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9.8 (owner decision 2026-10-17) · wireframe `design/wireframes/console/roster.md` "Join link and QR code" (Panel J) and `design/wireframes/sync/join-space.md` "Arriving from the class join link" · code `apps/web/src/components/console/JoinLinkParts.tsx`, `apps/web/src/lib/console/join-link.ts`, `packages/content-schema/src/schemas/app-shell.ts` (`joinLinkUrl`, `parseJoinLink`) · shots `shots/join-link-320.png`, `shots/join-link-375.png`, `shots/join-link-1280.png`

An agent design pass drawn in the shipped console styles (approved by the multi-agent review, owner decision 2026-10-12); the shots are of the build.

## Anatomy (inside the roster's code panel, under Copy and Regenerate)

1. A hairline (`border.subtle`) above the part.
2. **JOIN LINK** (`console.space.joinLink.title`): the code panel's caption style (`typography.size.caption`, `text.muted`, upper case).
3. **The link** without `https://` (`joinLinkText`): `typography.family.mono`, `size.body`, `text.primary`, `overflow-wrap: anywhere`, so it wraps inside 320 instead of scrolling.
4. **The note** (`console.space.joinLink.note`): "It opens Join a class with this code filled in. It holds the code only, never a name." (`size.bodySm`, `text.muted`).
5. **Copy link** / **Link copied** and **Show QR code** / **Hide QR code**: the console's pill buttons (`buttonBase`, at least `touchTarget.min` tall); the toggle carries `aria-expanded` and `aria-controls` (the image's region).
6. **The QR code** (`figure`): an SVG of `4 x touchTarget.min` (256 px), `max-width: 100%`; one path of the dark modules in `text.primary` on a `surface.paper` square with the four-module quiet zone, `shape-rendering: crispEdges`, `radii.md` and a `border.subtle` frame; `role="img"` named "QR code of the join link" (`.qr.label`); the caption "Scan it with the camera of a phone or tablet." (`.qr.caption`) under it.

## Rules

- **The link holds the code only**: `app origin /join#c=<code>`. A fragment is never sent to a server and never logged by one; no learner's name, no space id, no account id ever goes in it.
- **A class only, with a code**: a family (it joins through its home's "Open the app on this device") and a school (no learners) show none.
- **Error correction M**, the smallest version that holds the link (version 3, 29 modules, for `https://app.hangulroute.com/join#c=ABC234`): a phone reads it from a screen, a projector or a printout. Drawn with `qrcode-generator` 2.0.4 (MIT, pinned; in the third-party notices), read back in every CI unit run by `join-link-qr-decode.test.ts` (the drawn path rasterized with its quiet zone and decoded with jsQR 1.4.0, a pinned dev dependency), and in the Playwright run with the browser's `BarcodeDetector` where it exists.
- **Centred** on an empty class (the enlarged code panel), left-aligned otherwise.
- **Tokens only**; no new colour.

## States

- QR hidden (default) and shown; Copy link and Link copied; a clipboard that refuses keeps Copy link and says "Couldn't copy. Select the link above and copy it." (`.copyFailed`). Both outcomes are said in a polite live line under the buttons (`role="status"`), since a button's own label change is not reliably announced.
- A new code (Regenerate): the link and the QR follow it (the panel remounts with the new link).

## Measured (Playwright, `REPORTS_E2E=1`, mocked roster)

No sideways scroll at 320, 375 and 1280; the QR more than 200 px wide at every width; the drawn code read back as the link.

## Strings

`console.space.joinLink.title`, `.note`, `.copy.cta`, `.copied.cta`, `.copyFailed`, `.qr.show.cta`, `.qr.hide.cta`, `.qr.label`, `.qr.caption` (en, es, ko). The learner side: `learner.welcome.classLink.code`, `.next`, `.inApp` (Welcome on a device with no profile).
