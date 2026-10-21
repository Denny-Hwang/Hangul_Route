import { CATALOG, decodeDeck, routeCatalogOf, type LectureDeck, type Profile, type ProgressSnapshot } from '@hangul-route/content-schema';
import { LOCALES, getMessages, type UiLocale } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flags } from '../../../config/flags';
import { emptySnapshot } from '../../../logic/my-route/view';
import { useAccountStore } from '../../../store/account-store';
import { gateOpensDirectlyNow } from '../../../store/gate-now';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform, type RenderPlatform } from '../../../test-support/render';
import { LectureCard, learnerNextLessonHref, type LectureLearner } from '../LectureCard';

/**
 * AMENDMENTS-LECTURE-V2 row LV-6 (sections 3 E5, 7, 8 and 14; design/screens/lecture-entry/learner-card.md): the
 * Lecture mode card in the learner app's grown-up area, rendered through react-native-web. Web only; nothing while
 * `flags.lectureModeEnabled` is off; every press asks the gate again once the grown-up session has lapsed; and the
 * deck a row opens names no learner: with awkward names on the device, neither the link, its fragment nor the deck
 * (title included) holds a name, a piece of one, or a profile id.
 */

// The vitest lane resolves the native stub of the hand-off (no presenter root); the web build has the root.
vi.mock('../../../platform/present-handoff', () => ({ presenterRootExists: () => true, openPresenter: () => true }));

const en = getMessages('en');
const NOW = new Date('2026-10-17T12:00:00.000Z');
const ROUTE = routeCatalogOf(CATALOG).quests.filter((q) => q.grid && q.playable);

const profile = (id: string, displayName: string): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

/** Names a deck must never carry: punctuation, markup, a fragment look-alike, Hangul with a Latin alias, a bidi control, spaces. */
const AWKWARD = [
  profile('profile:aaaa1111', "Ana-Lucía O'Neil"),
  profile('profile:bbbb2222', '민아 "Mina" Kim'),
  profile('profile:cccc3333', '<b>Jo</b> & Co #d=1.x'),
  profile('profile:dddd4444', 'Zoë‮reversed'),
  profile('profile:eeee5555', '  Spaced   Out  '),
] as const;

const learnersOf = (profiles: readonly Profile[]): LectureLearner[] => profiles.map((p) => ({ id: p.id, name: p.displayName }));

const finished = (profileId: string, count: number): ProgressSnapshot => ({
  ...emptySnapshot(profileId),
  updatedAt: NOW.toISOString(),
  quests: ROUTE.slice(0, count).map((q) => ({ questId: q.id, episodeId: q.episodeId, startedAt: '2026-10-15T09:00:00.000Z', completedAt: '2026-10-15T09:10:00.000Z', stars: 2 as const, attempts: 1, accuracy: 0.9 })),
});

/** A device with these learners read and a grown-up PIN; the gate opens directly while `sessionOpen`. */
function seed(profiles: readonly Profile[], { sessionOpen = true, locale = 'en' as UiLocale } = {}): void {
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: locale, byProfile: {} });
  useProfileStore.setState({ profiles: [...profiles], activeId: profiles[0]?.id ?? null });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  useUiStore.setState({ parentGateOpenedAt: sessionOpen ? Date.now() : null });
  useProgressStore.setState({
    byProfile: Object.fromEntries(profiles.map((p, i) => [p.id, finished(p.id, i * 2)])),
    hydratedFor: new Set(profiles.map((p) => p.id)),
  });
}

const originalFlag = flags.lectureModeEnabled;

beforeEach(() => {
  flags.lectureModeEnabled = true;
  setPlatform('web');
});

afterEach(async () => {
  await cleanup();
  flags.lectureModeEnabled = originalFlag;
  resetPlatform();
  vi.restoreAllMocks();
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set() });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

const card = (root: ReactTestInstance): ReactTestInstance[] => byTestId(root, 'dashboard-lecture');

const deckOf = (href: string): LectureDeck => {
  expect(href.startsWith('/present#d=')).toBe(true);
  const decoded = decodeDeck(href.slice('/present'.length));
  if (!decoded.ok) throw new Error(`the link does not decode: ${decoded.reason}`);
  return decoded.deck;
};

/** Every piece of a name a deck could leak: the whole name, trimmed, and each word of three or more letters. */
const piecesOf = (name: string): string[] => [name, name.trim(), ...name.split(/[\s"'<>/&#=.\-‮]+/u).filter((w) => [...w].length >= 3)];

describe('LectureCard: where it is drawn (section 3 E5, LV-D1)', () => {
  it('web, flag on: the title, the line, a row per learner and Open lecture mode, in the dictionary words', async () => {
    seed(AWKWARD.slice(0, 2));
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 2))} onGate={() => undefined} />);
    expect(card(r.root)).toHaveLength(1);
    const texts = screenTexts(r.root);
    expect(texts).toContain(en.caregiver.lecture.title);
    expect(texts).toContain(en.caregiver.lecture.body);
    for (const p of AWKWARD.slice(0, 2)) expect(buttonsNamed(r.root, en.caregiver.lecture.next(p.displayName)), p.id).toHaveLength(1);
    expect(buttonsNamed(r.root, en.caregiver.lecture.open.cta)).toHaveLength(1);
    // Every button says it opens a new tab, read by a screen reader on the web too.
    expect(texts.filter((t) => t === en.caregiver.lecture.opensTab).length).toBeGreaterThanOrEqual(3);
    for (const id of AWKWARD.slice(0, 2).map((p) => `dashboard-lecture-next-${p.id}`)) {
      const [row] = byTestId(r.root, id);
      expect(row?.props['aria-describedby'], id).toBeTypeOf('string');
    }
  });

  it('draws nothing while flags.lectureModeEnabled is off: no card, no disabled control', async () => {
    flags.lectureModeEnabled = false;
    seed(AWKWARD.slice(0, 1));
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={() => undefined} />);
    expect(r.toJSON()).toBeNull();
  });

  it.each<RenderPlatform>(['ios', 'android'])('draws nothing on %s (the presenter is a root of the web build)', async (os) => {
    seed(AWKWARD.slice(0, 1));
    setPlatform(os);
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={() => undefined} />);
    expect(r.toJSON()).toBeNull();
  });

  it('with no learner on the device: only the line and Open lecture mode', async () => {
    seed([]);
    const r = await render(<LectureCard learners={[]} onGate={() => undefined} />);
    expect(byTestId(r.root, 'dashboard-lecture-rows')).toHaveLength(0);
    expect(buttonsNamed(r.root, en.caregiver.lecture.open.cta)).toHaveLength(1);
  });

  it('draws a learner row only once that learner’s progress is read', async () => {
    seed(AWKWARD.slice(0, 2));
    useProgressStore.setState({ hydratedFor: new Set([AWKWARD[0].id]) });
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 2))} onGate={() => undefined} />);
    expect(byTestId(r.root, `dashboard-lecture-next-${AWKWARD[0].id}`)).toHaveLength(1);
    expect(byTestId(r.root, `dashboard-lecture-next-${AWKWARD[1].id}`)).toHaveLength(0);
  });

  it.each(LOCALES)('%s: the card reads its own locale', async (locale) => {
    seed(AWKWARD.slice(0, 1), { locale });
    const m = getMessages(locale).caregiver.lecture;
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={() => undefined} />);
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.title);
    expect(texts).toContain(m.next(AWKWARD[0].displayName));
    expect(texts).toContain(m.open.cta);
  });
});

describe('LectureCard: the gate on every press (section 7 item 1)', () => {
  it('while the gate opens directly, a row opens its learner’s link and Open lecture mode opens /present', async () => {
    seed(AWKWARD.slice(0, 2));
    const open = vi.fn((_href: string) => true);
    const hrefFor = vi.fn((id: string) => `/present#d=for-${id}`);
    const onGate = vi.fn();
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 2))} onGate={onGate} opensDirectly={() => true} open={open} hrefFor={hrefFor} />);
    await press(byTestId(r.root, `dashboard-lecture-next-${AWKWARD[1].id}`)[0]!);
    expect(hrefFor).toHaveBeenCalledWith(AWKWARD[1].id, en.learner.presenter.presets);
    expect(open).toHaveBeenLastCalledWith(`/present#d=for-${AWKWARD[1].id}`);
    await press(buttonsNamed(r.root, en.caregiver.lecture.open.cta)[0]!);
    expect(open).toHaveBeenLastCalledWith('/present');
    expect(onGate).not.toHaveBeenCalled();
  });

  it('after the grown-up session lapses, a press asks for the PIN and builds and opens nothing; back with the gate open, the next tap opens', async () => {
    seed(AWKWARD.slice(0, 1), { sessionOpen: false });
    const open = vi.fn((_href: string) => true);
    const hrefFor = vi.fn((id: string) => `/present#d=for-${id}`);
    const onGate = vi.fn();
    // The default reads the gate fresh from the stores on every press (`gateOpensDirectlyNow`).
    expect(gateOpensDirectlyNow()).toBe(false);
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={onGate} open={open} hrefFor={hrefFor} />);
    const row = (): ReactTestInstance => byTestId(r.root, `dashboard-lecture-next-${AWKWARD[0].id}`)[0]!;
    await press(row());
    await press(buttonsNamed(r.root, en.caregiver.lecture.open.cta)[0]!);
    expect(onGate).toHaveBeenCalledTimes(2);
    expect(hrefFor).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();

    // The PIN screen opened the session and came back.
    useUiStore.setState({ parentGateOpenedAt: Date.now() });
    await press(row());
    expect(onGate).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith(`/present#d=for-${AWKWARD[0].id}`);
  });

  it('says so under the card when the browser gives no new tab, and keeps the tap', async () => {
    seed(AWKWARD.slice(0, 1));
    const open = vi.fn((_href: string) => false);
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={() => undefined} opensDirectly={() => true} open={open} />);
    expect(byTestId(r.root, 'dashboard-lecture-blocked')).toHaveLength(0);
    await press(buttonsNamed(r.root, en.caregiver.lecture.open.cta)[0]!);
    expect(screenTexts(byTestId(r.root, 'dashboard-lecture-blocked')[0]!)).toContain(en.caregiver.lecture.blocked);
    open.mockReturnValue(true);
    await press(buttonsNamed(r.root, en.caregiver.lecture.open.cta)[0]!);
    expect(byTestId(r.root, 'dashboard-lecture-blocked')).toHaveLength(0);
  });

  it('a row whose deck cannot be built still opens the presenter home, never a dead button', async () => {
    seed(AWKWARD.slice(0, 1));
    const open = vi.fn((_href: string) => true);
    const r = await render(<LectureCard learners={learnersOf(AWKWARD.slice(0, 1))} onGate={() => undefined} opensDirectly={() => true} open={open} hrefFor={() => null} />);
    await press(byTestId(r.root, `dashboard-lecture-next-${AWKWARD[0].id}`)[0]!);
    expect(open).toHaveBeenCalledWith('/present');
  });
});

describe('LectureCard: no name in the link or the deck (sections 7 item 4 and 8)', () => {
  it.each(LOCALES)('%s: awkward names never reach the fragment, the deck or its title, and no profile id does', async (locale) => {
    seed(AWKWARD, { locale });
    const hrefs: string[] = [];
    const open = vi.fn((href: string) => {
      hrefs.push(href);
      return true;
    });
    const r = await render(<LectureCard learners={learnersOf(AWKWARD)} onGate={() => undefined} opensDirectly={() => true} open={open} />);
    for (const p of AWKWARD) await press(byTestId(r.root, `dashboard-lecture-next-${p.id}`)[0]!);
    expect(hrefs).toHaveLength(AWKWARD.length);

    const words = getMessages(locale).learner.presenter.presets;
    for (const href of hrefs) {
      const deck = deckOf(href);
      expect(deck).toMatchObject({ v: 1, source: 'quick', picker: null });
      expect([words.next.title, words.zero.short]).toContain(deck.title);
      const json = JSON.stringify(deck);
      for (const p of AWKWARD) {
        for (const piece of piecesOf(p.displayName)) {
          for (const where of [href, json, deck.title]) expect(where.includes(piece), `${p.id}: "${piece}"`).toBe(false);
        }
        for (const where of [href, json]) {
          expect(where.includes(p.id), p.id).toBe(false);
          expect(where.includes(p.id.slice('profile:'.length)), p.id).toBe(false);
        }
      }
    }
  });

  it('each learner gets their own next lesson: a learner further on the route starts further on', async () => {
    seed(AWKWARD.slice(0, 3));
    const first = deckOf(learnerNextLessonHref(AWKWARD[0].id, en.learner.presenter.presets, NOW) as string);
    const third = deckOf(learnerNextLessonHref(AWKWARD[2].id, en.learner.presenter.presets, NOW) as string);
    // The first learner has finished nothing; the third has finished the first four route quests.
    expect(first.blocks[0]).toEqual({ kind: 'quest', id: ROUTE[0]!.id });
    expect(third.blocks[0]).toEqual({ kind: 'quest', id: ROUTE[4]!.id });
    expect(first.title).toBe(en.learner.presenter.presets.next.title);
  });

  it('a learner whose progress was never stored starts at the first route quest', () => {
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(['profile:new']) });
    const deck = deckOf(learnerNextLessonHref('profile:new', en.learner.presenter.presets, NOW) as string);
    expect(deck.blocks[0]).toEqual({ kind: 'quest', id: ROUTE[0]!.id });
  });
});

describe('the dashboard and the PIN screen (source)', () => {
  const SRC = join(__dirname, '..');
  const code = (file: string): string =>
    readFileSync(join(SRC, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('the card follows GrownUpHomeCard, before the learner cards, and its gate is the PIN screen for LectureMode', () => {
    const dashboard = code('ParentDashboardScreen.tsx');
    const card = dashboard.indexOf('<LectureCard');
    expect(card).toBeGreaterThan(dashboard.indexOf('<GrownUpHomeCard'));
    expect(card).toBeLessThan(dashboard.indexOf('profiles.map((p) => {'));
    expect(dashboard.slice(card, dashboard.indexOf('/>', card))).toContain("onGate={() => navigation.navigate('PinEntry', { next: 'LectureMode' })}");
  });

  it('the Family Dashboard heading wraps inside a word, so it never runs past a narrow window', () => {
    expect(code('ParentDashboardScreen.tsx')).toMatch(/<Heading level="title" style=\{\{ overflowWrap: 'anywhere' \} as TextStyle\}>\s*\{copy\.zoneLabel\}/);
  });

  it('after a correct PIN the PIN screen goes back to the dashboard, which opens the tab on the next tap', () => {
    const pin = code('PinEntryScreen.tsx');
    const branch = pin.slice(pin.indexOf("route.params.next === 'LectureMode'"));
    expect(branch.slice(0, branch.indexOf('} else if'))).toMatch(/navigation\.goBack\(\);/);
    expect(pin.indexOf("route.params.next === 'LectureMode'")).toBeGreaterThan(pin.indexOf('const proceed = ('));
  });
});
