# Screen 26 — Story sources

**Where every fact in a story comes from, claim by claim.**

Spec: `docs/specs/F-STORY-002-story-reader.md` §3.8, §3.11, §3.12 · wireframe: `design/wireframes/story/sources.md` (I, J) · screen spec: `design/components/StorySourcesScreen/spec.md` · code (built): `apps/mobile/src/screens/story/StorySourcesScreen.tsx`, `SourcesParts.tsx`

## 1. Context

- **Who**: grown-ups (parents, teachers, culture reviewers) and curious learners of any age.
- **Where**: from the reader's top bar and end page, the story's episode page, Culture notes, and links from a scene.
- **Why**: Hangul Route promises that its stories' facts are sourced exactly. This screen makes that visible: each claim, the scene that uses it, every source with its quote and link, how the story was checked, and corrections. It is a reference page, not a learner screen: counts are fine, nothing is scored, and leaving the app needs the grown-up gate.

## 2. Layout

Top to bottom, one scrolling column (`layout.maxWidth.reading` on wide windows):

1. **Header**: Back (top-left), "Sources" heading; the story title (`KoreanText`: Korean, romanization, English); the "Traditional tale" pill and the retelling note for tales.
2. **Reference line**: the one-line source headline (in the source language).
3. **Checked line**: "Checked in N independent passes · last checked <date> · story version <n>", with a "How it was checked" disclosure.
4. **Grown-up note** (only when the story has one).
5. **Counts**: "10 facts · 27 sources" (the sample story).
6. **Corrections** (only when any): date, summary, the fact concerned.
7. **Scene sections**: "Scene 2 · <caption>", then fact cards: scope label ("What we know" / "What the tale says"), the claim, a "Korean" disclosure, an "Updated" pill when revised, then "Sources (n)" with one block per source (title, publisher, "accessed <date>", the quote, the URL as plain text, **Copy link**, **Open link**), then approximations.
8. **Used in questions and notes**: facts only the checks or culture notes cite.

States to draw: a highlighted fact (outline plus the "Highlighted" pill), the open-link failure block, the web "Grown-up check done" line.

## 3. Visual style

- Canvas `surface.canvas`; fact cards `surface.paper` with the `card` shadow; source blocks inset on `surface.sunken`.
- Scope labels as `Pill`s: "What we know" neutral, "What the tale says" `brand.secondaryLight` fill (a different label, never a warning colour).
- URLs in `text.secondary`, selectable, wrapping anywhere. Copy and Open are ghost buttons; there is no primary button.
- Highlight: `borderWidth.base` `border.focus` outline plus the word "Highlighted".
- Quotes and Korean claims keep their source language; Korean text carries `lang="ko"`.
- Dense but calm: generous `spacing.md` between source blocks, `typography.size.body` minimum.

## 4. Exact copy

UI strings come from `packages/i18n` (`learner.story.sources`); English shown:

- **"Sources"**, **"How it was checked"**, **"Corrections"**, **"Korean"**
- **"What we know"**, **"What the tale says"**, **"Updated"**, **"Highlighted"**
- **"Sources (2)"**, **"accessed 2026-10-09"**
- **"Copy link"**, **"Open link"**, **"Link copied"**
- **"Open this link in a browser: <url>"**, **"Opening a link needs a connection."**
- **"Grown-up check done. Tap Open link to open it."**
- **"10 facts · 27 sources"**, **"Used in questions and notes"**
- **"One version of a story told in many versions"**
- Empty: **"No sources are listed for this story."**

Claims, titles, publishers and quotes come from the story data; mock with `content/stories/sillok-royal-historians.json`.

## 5. Reference

Text references only: a museum object label with a bibliography; a well-made encyclopedia citation list; the existing Card detail back face for card treatment.

## 6. Claude Design prompt

```prompt
Design the Story Sources screen for Hangul Route, a Korean-learning app. This page is for
grown-ups and curious learners: it lists every factual claim of a story with its citations.
Output: two portrait phone frames (390 x 844) and one wide frame (1180 x 820, a centred
720-wide column).

Use the Hangul Route design tokens by name: canvas surface.canvas, cards surface.paper with
the "card" shadow, inset blocks surface.sunken, text text.primary / text.secondary, focus
outline border.focus, subtle lines border.subtle. Body text 18 minimum. Buttons at least 64
tall. No primary button on this page: Copy link and Open link are ghost buttons.

Frame 1 (top of the page): back arrow, heading "Sources", story title in three lines
(호야, 사관을 만나다 / Hoya, sagwaneul mannada / Hoya Meets the Royal Historians), a one-line
source headline in Korean, "Checked in 3 independent passes · last checked 2026-10-10 ·
story version 1", a collapsed row "How it was checked", the line "10 facts · 27 sources",
then section "Scene 2 · A palace hall" with one fact card: pill "What we know", the claim
"Historians attended wherever the king met his officials and recorded what they saw and
heard.", a collapsed row "Korean",
"Sources (2)" and the first source block (title 실록은 누가 기록했을까, publisher
국가기록원, "accessed 2026-10-09", a short quoted Korean sentence, a long https URL as
plain wrapping text, ghost buttons "Copy link" and "Open link").

Frame 2: the same fact card highlighted (focus-colour outline plus a small pill
"Highlighted"), and below it the failure block "Open this link in a browser:" with the URL
and "Copy link".

Frame 3 (wide): the same content in a centred reading column with margins.

Anti-patterns: red or warning colours on "What the tale says"; links styled as big buttons;
truncated URLs; icons or emoji in place of words; a score or result look.
```

## 7. Acceptance checklist

- [ ] Every source shows title, publisher, access date, quote and the full URL as text
- [ ] "What we know" and "What the tale says" are told apart by words, not colour alone
- [ ] Highlight = outline plus the word "Highlighted"
- [ ] No primary button; Open link is a ghost button (a grown-up action)
- [ ] Long URLs wrap; nothing is truncated
- [ ] Token names only; text at least 18; controls at least 64 tall

## 8. Output path

- `design/screens/story/sources__v1__YYYY-MM-DD.png`
