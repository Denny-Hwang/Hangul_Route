# Offline page for grown-up paths (design mock v1, drawn as A-2 built it)

Wireframe: `design/wireframes/shell/offline.md` · spec §3.4, §3.12 · code: `apps/mobile/scripts/pwa/grown-ups.mjs` `renderGrownUpsOffline` (A-2, #386, merged) · mock: `mock/offline.html` (the generated page on this commit, unedited) · shots: `shots/offline-375.png`, `offline-1280.png`

The page shipped before this pass. **No change is proposed.**

```
          [no-signal outline 64]       border.shape, stroke borderWidth.base
             You're offline            h1, size.title bold
  Grown-up pages need the internet.    text.secondary
  Learning still works offline.
  [[      Back to learning      ]]     primary, max 400, -> /
  [          Try again          ]      paper with a brand.primary outline, -> reload
```

- Self-contained: inline styles from tokens, no external URL, a small script that picks the strings by `navigator.languages` (only English ships today, so the page carries one locale).
- Centred column at every width, `layout.maxWidth.reading`; no frame (the page cannot know the account).
- Its buttons (`radii.lg`, `size.bodyLg` semibold, `touchTarget.min`) differ a little from the console's pill buttons; that is the shipped page and acceptable for an error page. A later restyle would go through A-2's generator and its tests, not this pass.
