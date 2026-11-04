import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiLocale, Weekday } from '@hangul-route/content-schema';
import { Body, LayoutProvider, Pill, layoutClassFor } from '@hangul-route/design-system';
import { formatDate, getMessages } from '@hangul-route/i18n';
import { WEEKDAY_DATE, fromClassPillOf, weeklyPlanLine, type BlendWeek } from '../../../logic/route/blend-view';
import { useLocaleStore } from '../../../store/locale-store';
import { useRouteStore } from '../../../store/route-store';
import { buttonsNamed, byTestId, cleanup, hostNodes, press, render, resetPlatform, screenTexts } from '../../../test-support/render';
import { BlendPlanLine, ClassTodayLine, OwnBackLine, PlanRowBlendLine, ProposalInsteadCard, RefreshCard } from '../BlendParts';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 7 (row BL-7; design/wireframes/journey/route-class-blend.md B1 to B6): the
 * learner's class days and practice days pieces at 320 x 568 in en, es and ko. One text node for the weekly plan line,
 * one From class pill per row (never two labels with the same words), Refresh as one named button with no count,
 * "Class today." with no question, and the resting row's See it.
 */

const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
const PHONE = layoutClassFor({ width: 320, height: 568 });

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

function useUiLocale(locale: UiLocale): void {
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: locale, byProfile: {} });
}

const atPhone = (el: ReactElement): ReactElement => <LayoutProvider value={PHONE}>{el}</LayoutProvider>;

const lineOf = (locale: UiLocale, w: BlendWeek): string =>
  weeklyPlanLine(w, getMessages(locale).learner.route.blend, (day) => formatDate(locale, `${WEEKDAY_DATE[day]}T00:00:00.000Z`, 'weekdayLong', { utc: true }));

/** Host nodes that hold text directly (react-native-web's Text). */
const textNodes = (root: ReactTestInstance): ReactTestInstance[] => hostNodes(root, (n) => n.children.some((c) => typeof c === 'string'));

function hiddenFromReaders(node: ReactTestInstance | null): boolean {
  for (let at = node; at; at = at.parent) if (typeof at.type === 'string' && (at.props['aria-hidden'] === true || at.props['aria-hidden'] === 'true')) return true;
  return false;
}

/** The visible words of a host tree (text children not hidden from readers), each once per node. */
const visibleWords = (root: ReactTestInstance): string[] =>
  textNodes(root)
    .filter((n) => !hiddenFromReaders(n))
    .map((n) => n.children.filter((c): c is string => typeof c === 'string').join(''));

describe.each(LOCALES)('%s at 320 x 568', (locale) => {
  it('B1: the weekly plan line is one text node with the whole sentence', async () => {
    useUiLocale(locale);
    const text = lineOf(locale, { classDays: ['tue'], practiceDays: ['wed', 'fri', 'sun'] });
    const r = await render(atPhone(<BlendPlanLine text={text} />));
    const nodes = textNodes(r.root);
    expect(nodes).toHaveLength(1);
    expect(visibleWords(r.root)).toEqual([text]);
    expect(byTestId(r.root, 'my-route-blend-line')).toHaveLength(1);
  });

  it('B2: "Class today." is one calm line: no button, no question', async () => {
    useUiLocale(locale);
    const r = await render(atPhone(<ClassTodayLine />));
    expect(visibleWords(r.root)).toEqual([getMessages(locale).learner.route.blend.classToday]);
    expect(hostNodes(r.root, (n) => n.props.role === 'button')).toHaveLength(0);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/\?|¿/);
  });

  it('B2: a row with a lesson met in class shows one From class pill with the glyph; no row shows two identical labels', async () => {
    useUiLocale(locale);
    const m = getMessages(locale);
    const rows = [true, undefined].map((fromClass) => fromClassPillOf({ enabled: true, fromClass, label: m.learner.homework.from.teacher, metLabel: m.a11y.route.blend.fromClassMet }));
    const r = await render(
      atPhone(
        <View>
          {rows.map((pill, i) => (
            <View key={i} testID={`row-${i}`} style={{ flexDirection: 'row' }}>
              <Body weight="semibold" style={{ flex: 1 }}>
                {`First letters ${i + 1}`}
              </Body>
              <Pill tone="nudge" size="sm" {...pill} testID={`pill-${i}`} />
            </View>
          ))}
        </View>,
      ),
    );
    for (const i of [0, 1]) {
      const row = byTestId(r.root, `row-${i}`)[0]!;
      const words = visibleWords(row);
      expect(new Set(words).size, words.join(' | ')).toBe(words.length);
      expect(words.filter((w) => w === m.learner.homework.from.teacher)).toHaveLength(1);
    }
    const met = byTestId(r.root, 'pill-0')[0]!;
    expect(met.props['aria-label']).toBe(m.a11y.route.blend.fromClassMet);
    expect(met.props.role).toBe('img');
    // The glyph is drawn and hidden from screen readers.
    const glyph = hostNodes(met, (n) => String(n.type) === 'svg-Svg');
    expect(glyph).toHaveLength(1);
    expect(hiddenFromReaders(glyph[0]!)).toBe(true);
    const plain = byTestId(r.root, 'pill-1')[0]!;
    expect(plain.props['aria-label']).toBeUndefined();
    expect(hostNodes(plain, (n) => String(n.type) === 'svg-Svg')).toHaveLength(0);
  });

  it('B3: Refresh is one named button with its line, no count, and it opens what the press handler routes', async () => {
    useUiLocale(locale);
    const m = getMessages(locale);
    const onPress = vi.fn();
    const r = await render(atPhone(<RefreshCard onPress={onPress} />));
    const buttons = buttonsNamed(r.root, m.a11y.route.blend.refresh);
    expect(buttons).toHaveLength(1);
    expect(visibleWords(r.root)).toEqual([m.learner.route.blend.refresh, m.learner.route.blend.refreshLine]);
    expect(screenTexts(r.root).join(' ')).not.toMatch(/\d/);
    await press(buttons[0]!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('B5: the resting row says resting, with See it; B6: the proposal line alone', async () => {
    useUiLocale(locale);
    const words = getMessages(locale).learner.route.blend;
    const onSeeIt = vi.fn();
    const r = await render(atPhone(<PlanRowBlendLine kind="resting" onSeeIt={onSeeIt} />));
    expect(visibleWords(r.root)).toEqual([words.ownResting, words.seeIt]);
    await press(buttonsNamed(r.root, words.seeIt)[0]!);
    expect(onSeeIt).toHaveBeenCalledTimes(1);
    const instead = await render(atPhone(<PlanRowBlendLine kind="instead" onSeeIt={onSeeIt} />));
    expect(visibleWords(instead.root)).toEqual([words.proposalInstead]);
    expect(hostNodes(instead.root, (n) => n.props.role === 'button')).toHaveLength(0);
  });

  it("Home's proposal line keeps Not now and offers no plan", async () => {
    useUiLocale(locale);
    const m = getMessages(locale);
    const onNotNow = vi.fn();
    const r = await render(atPhone(<ProposalInsteadCard onNotNow={onNotNow} />));
    expect(visibleWords(r.root)).toEqual([m.learner.route.blend.proposalInstead, m.learner.weeklyPlan.homePrompt.notNow.cta]);
    await press(buttonsNamed(r.root, m.learner.weeklyPlan.homePrompt.notNow.cta)[0]!);
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });

  it('the own plan back line shows its words once and marks itself seen', async () => {
    useUiLocale(locale);
    const seen = vi.spyOn(useRouteStore.getState(), 'markBackSeen').mockResolvedValue(undefined);
    const r = await render(atPhone(<OwnBackLine profileId="p1" onOverview={() => undefined} />));
    expect(visibleWords(r.root)[0]).toBe(getMessages(locale).learner.route.blend.ownBack);
    expect(seen).toHaveBeenCalledWith('p1', expect.any(String));
  });
});

/**
 * Assumption d (section 17): the line fits the Route card at 320 x 568 in at most 3 lines in es and ko, for 1 to 3
 * practice weekday names, 1 or 2 class days and every collapsed form. The BL-D mock measured those lines in Chromium
 * at 320 x 568 (`design/screens/route-blend/shots/measurements.json`, `d`): every case there takes 3 lines or fewer.
 * The renderer here draws no glyphs, so each line is wrapped between words (Korean wraps between words too,
 * `hangul-word` / `keep-all`) at the widest line, in characters, that still wraps every measured case into at least
 * the lines Chromium drew (so the rule is no kinder than the mock); every built week must then wrap in 3 lines or fewer.
 */
describe('assumption d: the line fits at 320 x 568 in es and ko', () => {
  type Measured = { lang: string; text: string; lines: number };
  const measured = JSON.parse(readFileSync(join(__dirname, '../../../../../../design/screens/route-blend/shots/measurements.json'), 'utf8')) as { d: Measured[] };
  const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const wrap = (text: string, perLine: number): number => {
    let lines = 1;
    let used = 0;
    for (const word of text.split(' ')) {
      const add = used === 0 ? word.length : used + 1 + word.length;
      if (add <= perLine) used = add;
      else {
        lines += 1;
        used = word.length;
      }
    }
    return lines;
  };
  const weeks = (): BlendWeek[] => {
    const out: BlendWeek[] = [];
    for (const classDays of [['tue'], ['wed'], ['sat'], ['mon', 'thu'], ['wed', 'sat']] as Weekday[][]) {
      const free = DAYS.filter((d) => !classDays.includes(d));
      // 1 to 3 names: every pick of the free days.
      for (let a = 0; a < free.length; a += 1) {
        out.push({ classDays, practiceDays: [free[a]!] });
        for (let b = a + 1; b < free.length; b += 1) {
          out.push({ classDays, practiceDays: [free[a]!, free[b]!] });
          for (let c = b + 1; c < free.length; c += 1) out.push({ classDays, practiceDays: [free[a]!, free[b]!, free[c]!] });
        }
      }
      // The collapsed forms: most days, every day except each free weekday, every day.
      out.push({ classDays, practiceDays: free.slice(0, 4) }, { classDays, practiceDays: DAYS });
      for (const left of free) out.push({ classDays, practiceDays: DAYS.filter((d) => d !== left) });
    }
    return out;
  };

  it.each(['es', 'ko'] as const)('%s', (locale) => {
    const cases = measured.d.filter((d) => d.lang === locale);
    expect(cases.length).toBeGreaterThan(5);
    expect(cases.every((d) => d.lines <= 3)).toBe(true);
    // The widest line (in characters) at which the rule still wraps every measured case into at least its drawn lines.
    let perLine = 10;
    while (cases.every((d) => wrap(d.text, perLine + 1) >= d.lines)) perLine += 1;
    // The rule is no kinder than Chromium: it never wraps a measured case into fewer lines than the mock drew.
    for (const d of cases) expect(wrap(d.text, perLine), d.text).toBeGreaterThanOrEqual(d.lines);
    for (const w of weeks()) {
      const text = lineOf(locale, w);
      expect(wrap(text, perLine), text).toBeLessThanOrEqual(3);
    }
  });
});
