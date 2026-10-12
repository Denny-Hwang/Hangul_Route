# Shell/Moved — old grown-up links on hangulroute.com forward to the app (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.13 (stubs, `legacyConsoleTarget`) · OD-5
Audience: **grown-ups with an old bookmark, emailed link or a Stripe return**; neutral copy
Artifact: static stub pages written by `apps/web/scripts/console-split.mjs --role site` in place of `teach*.html` and `parent*.html` when `CONSOLE_ORIGIN` is set (A-8)

## Scenario (Given-When-Then)

Given: the site build has `CONSOLE_ORIGIN=https://app.hangulroute.com`
When: someone opens `hangulroute.com/teach/space?id=…` (or `/teach/billing?checkout=success`, `/parent`, `/teach`)
Then: the browser moves at once to the same page on app.hangulroute.com, keeping the query, the fragment and the grown-up's console language; without script they still see one line and a link

## Screen goal

"Forward to the same page on the app host." (no decision for the visitor)

## Box diagram

```
+-----------------------------------+
|                                   |
|   1 line: grown-up pages moved    |  <- polite live region
|   to app.hangulroute.com          |
|   [ Go there now ]                |  <- visible link = the computed target
|                                   |
+-----------------------------------+
```

- Normally visible for a fraction of a second (script replaces the location immediately).
- `noindex`; no tracking; no name, no account data.

## Interaction points

- automatic: `location.replace(CONSOLE_ORIGIN + legacyConsoleTarget(path) + query + fragment)`, adding `lang=` from the site's stored console language when the query has none
- [ Go there now ] → the same target (works without script; without script the query is kept by the link, the fragment is not)

## Navigation graph

Enter from: old bookmarks · emails · Stripe Checkout / portal sessions created before the switch · old landing links still cached
Exit to:    `shell/signin` (via `/teach` router) · `console/roster` · `/account/billing` · `shell/parent-home` · `console/onboarding-role` (`/start`)

## States

- **success**: immediate forward.
- **empty**: not applicable.
- **error**: script blocked → the line and the link; app host unreachable → the browser's own error on the target (nothing to do on the site).

## Data needs

- reads: `location`, site localStorage `hr:console:uiLocale` (read only, through a try/catch)
- writes: nothing

## Open questions

- HTTP 301 redirects are not used (OD-5); default stays stub pages, which keep the fragment on every browser and are covered by `apps/web/e2e/console-moved.spec.ts`.
