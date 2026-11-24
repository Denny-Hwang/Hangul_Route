import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DisplaySheetProps } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-DISPLAY-NAV section 11 and F-TCH-004 section 3.14: a language chosen on the Display
 * (Aa) sheet sends `locale.changed` from the learner app only. The presenter sends lecture events
 * only, and All lessons none for a display choice, so their sheets store the language and tell the
 * other tabs without reporting it. The design-system sheet is replaced by a stand-in that hands
 * its props to the test, so the language row's choice and the confirm step's Use are driven
 * directly.
 */
const sheet = vi.hoisted(() => ({ props: null as DisplaySheetProps | null }));
vi.mock('@hangul-route/design-system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hangul-route/design-system')>()),
  DisplaySheet: (props: DisplaySheetProps) => {
    sheet.props = props;
    return null;
  },
}));
const track = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../../../platform/telemetry', () => ({ track }));

import { DeviceDisplaySheet } from '../../../components/DeviceDisplaySheet';
import { useLocaleStore } from '../../../store/locale-store';
import { render, resetPlatform, setPlatform } from '../../../test-support/render';

beforeEach(() => {
  sheet.props = null;
  track.mockClear();
  useLocaleStore.setState({ detected: 'en', device: 'en', deviceAt: '2026-10-16T09:00:00.000Z', textSize: 'standard', hydrated: true });
});

afterEach(() => {
  useLocaleStore.setState({ device: null, deviceAt: null });
});

/** Opens the sheet, picks 한국어 and confirms with Use. */
async function chooseKorean(element: ReactElement): Promise<void> {
  await render(element);
  await act(async () => {
    sheet.props!.language!.onSelect('ko');
  });
  expect(sheet.props!.language!.confirm).not.toBeNull();
  await act(async () => {
    sheet.props!.language!.confirm!.onUse();
  });
}

describe('the Display sheet reports a language only from the learner app (AMENDMENTS-DISPLAY-NAV section 11)', () => {
  it('the learner app (Home, Profile): one locale.changed with source settings and scope device', async () => {
    await chooseKorean(<DeviceDisplaySheet visible onClose={() => undefined} />);
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({ name: 'locale.changed', payload: { from: 'en', to: 'ko', scope: 'device', source: 'settings' } });
  });

  it('the presenter and All lessons (reportLocale false): the language is stored, nothing is sent', async () => {
    await chooseKorean(<DeviceDisplaySheet visible onClose={() => undefined} reportLocale={false} />);
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(track).not.toHaveBeenCalled();
  });

  it('a text size sends nothing from any sheet', async () => {
    await render(<DeviceDisplaySheet visible onClose={() => undefined} />);
    await act(async () => {
      sheet.props!.textSize.onSelect('largest');
    });
    expect(useLocaleStore.getState().textSize).toBe('largest');
    expect(track).not.toHaveBeenCalled();
  });

  it('every sheet of the presenter and All lessons passes reportLocale false; the learner app\'s pass nothing', () => {
    const SRC = join(__dirname, '..', '..', '..');
    const read = (file: string): string => readFileSync(file, 'utf8');
    const tags = (file: string, name: string): string[] => read(file).match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`, 'g')) ?? [];
    const sheets = (file: string): string[] => tags(file, 'DeviceDisplaySheet');
    const silent = [join(SRC, '..', 'PresenterApp.tsx')].flatMap(sheets);
    const reporting = [join(SRC, 'screens', 'home', 'HomeScreen.tsx'), join(SRC, 'screens', 'profile', 'ProfileScreen.tsx')].flatMap(sheets);
    expect(silent.length).toBeGreaterThan(0);
    for (const tag of silent) expect(tag).toContain('reportLocale={false}');
    expect(reporting.length).toBeGreaterThan(1);
    for (const tag of reporting) expect(tag).not.toContain('reportLocale');
    // All lessons' Display sheet is its header's (AMENDMENTS-DISPLAY-NAV section 7.1): BrowseApp provides BrowseScreenHeader, which
    // draws the header with reportLocale false, and the header hands that to its sheet. The learner app's slot reports.
    const header = join(SRC, 'components', 'LearnerScreenHeader.tsx');
    expect(read(join(SRC, '..', 'BrowseApp.tsx'))).toContain('<ScreenHeaderSlotContext.Provider value={BrowseScreenHeader}>');
    expect(read(join(SRC, '..', 'App.tsx'))).toContain('<ScreenHeaderSlotContext.Provider value={LearnerScreenHeader}>');
    expect(tags(header, 'LearnerScreenHeader')).toEqual(['<LearnerScreenHeader {...props} reportLocale={false} />']);
    expect(sheets(header)).toEqual([expect.stringContaining('reportLocale={reportLocale}')]);
    expect(read(join(SRC, 'screens', 'browse', 'browse-ui.tsx'))).not.toContain('<DeviceDisplaySheet');
  });
});

/**
 * F-A11Y-001 OD-AF3 (d) (row AF-1; AnswerFeedback D10): the learner app's sheet on the web carries "I use a screen
 * reader", the level check's answer kept for the device. Native reads the platform screen reader instead, and the
 * presenter runs no answer rounds.
 */
describe('the Display sheet\'s screen-reader row (F-A11Y-001 OD-AF3 (d))', () => {
  afterEach(() => {
    resetPlatform();
    useLocaleStore.setState({ screenReader: false });
  });

  it('the learner app on the web: the level check\'s label, its own help line, and the device flag both ways', async () => {
    useLocaleStore.setState({ screenReader: false });
    await render(<DeviceDisplaySheet visible onClose={() => undefined} />);
    const row = sheet.props!.screenReader!;
    expect(row.label).toBe('I use a screen reader');
    expect(row.help).toBe('Tap Next to go on. Sounds play when you tap them.');
    expect(row.value).toBe(false);
    await act(async () => {
      row.onChange(true);
    });
    expect(useLocaleStore.getState().screenReader).toBe(true);
    expect(sheet.props!.screenReader!.value).toBe(true);
    expect(track).not.toHaveBeenCalled();
  });

  it('native and the presenter draw no row', async () => {
    await render(<DeviceDisplaySheet visible onClose={() => undefined} reportLocale={false} />);
    expect(sheet.props!.screenReader).toBeNull();
    for (const os of ['ios', 'android'] as const) {
      setPlatform(os);
      await render(<DeviceDisplaySheet visible onClose={() => undefined} />);
      expect(sheet.props!.screenReader).toBeNull();
    }
  });
});

