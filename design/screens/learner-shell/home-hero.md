# Home: the next-lesson hero (screen spec, DN-8)

Spec: AMENDMENTS-DISPLAY-NAV section 9.1 · wireframe `design/wireframes/home/next-lesson-hero.md` · mock `mock/home-hero.html`, `mock/home-hero-rest.html`

## Anatomy (top to bottom)

1. **Root header** (`ScreenHeader` with no leading control): Hoya waving, "Hi, Mina!" (`learner.home.greeting`), then **Display (Aa)** and the **Profile** button at the right. The subtitle and the streak, cards and stars pills are unchanged.
2. **Hero** (`.hero`): paper, `borderWidth.thick` `brand.primary`, `radii.lg`, `shadows.card`, `spacing.xl` padding. "Next lesson" eyebrow (`learner.home.hero.eyebrow`, `size.bodySm` bold `brand.primaryDark`); the lesson title (`size.title` with the heading half rule, localized); where it sits, "Stage 1 · Meet the Letters · lesson 2 of 3" (`learner.home.hero.where`); the route strip's goal line when a goal source exists (`learner.myRoute.home.strip.goal`; the plan week line `.week` under it when there is one); **Start** (`learner.home.hero.start.cta`, `rn-hero`: full width, `touchTarget.hero`); **See your Learning Route** (`learner.home.hero.route.cta`, a link with `arrow-right`).
3. **Today with Hoya** and the three F-HW-001 cards (same chains, order and completion; card ② compact when it names the hero's lesson, States below); then the level-check card, Homework and the Tip, unchanged. The Home route strip is gone (folded into the hero).
4. The tab bar, unchanged.

## States

- Next lesson (`home-hero.html`): the usual case; card ② names the same lesson, so it is drawn **compact** (`.mission.same`: `surface.sunken`, flat, no art, `touchTarget.min` tall, not a button) with "Same as your next lesson above" (`learner.home.mission.sameAsHero`): Home offers the lesson once, through the hero's Start. It still shows done and still collects (F-HW-001 §3.2). A card ② that names another quest is the normal card.
- Rest (`home-hero-rest.html`): the route's rest line (`learner.myRoute.hero.rest`) as the hero's title and its existing action (Open stories); no Start.
- Route cannot be read: no hero (fail open), Home as today.

## Accessibility

The hero is a `section` labelled by its eyebrow; Start is the first button after the header; the first screen at 360 x 740 shows the whole hero with Start (`home-hero-360-first.png`); at 320 with 200 % text everything wraps (`home-hero-320-text200.png`).
