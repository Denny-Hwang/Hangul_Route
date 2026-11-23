import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { useState } from 'react';
import { Text } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));

import { flags } from '../../../config/flags';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, press, render, screenTexts, unmount } from '../../../test-support/render';
import { BootGate } from '../BootGate';
import { resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.4 (row DP-1c; test 12 of section 6): the boot decides from store state.
 * A list that could not be read shows ProgressReadFailedScreen, never Welcome (the app's first route on a device with
 * no profile); the active learner's progress in `loadFailedFor` shows it too; Try again reruns the full read (list)
 * or that learner's hydrate (learner); Choose another learner shows with 2 learner profiles only; the post-hydrate
 * chain runs once, after the first boot that is not held. A grown-up can help is row DP-1d's (not drawn here).
 */
const m = getMessages('en').learner.progressReadFailed;
const WELCOME = 'Welcome (the navigator)';
const learner = (id: string): Profile => ({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' });
const chooserFlag = flags.whoChooserEnabled;
const realHydrate = useProgressStore.getState().hydrate;

const app = vi.fn(({ chooseLearner }: { chooseLearner: boolean }) => <Text>{`${WELCOME}${chooseLearner ? ' + chooser' : ''}`}</Text>);
const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

function listFailed(cause: 'read' | 'parse' = 'read', kept = false): void {
  useProfileStore.setState({ hydrated: false, profiles: [], activeId: null, loadFailed: cause, listCopyKept: kept });
}

/** As App.tsx: the caller keeps `opened`, so a BootGate mounted again opens at once. */
function Harness({ firstRead, rereadAll, onOpen, gateKey }: { firstRead: Promise<void>; rereadAll: () => Promise<void>; onOpen: () => void; gateKey: number }) {
  const [opened, setOpened] = useState<{ chooseLearner: boolean } | null>(null);
  return (
    <BootGate
      key={gateKey}
      firstRead={firstRead}
      rereadAll={rereadAll}
      settle={async () => undefined}
      opened={opened}
      onOpen={(open) => {
        setOpened(open);
        onOpen();
      }}
    >
      {(open) => app(open)}
    </BootGate>
  );
}

async function boot(props: { rereadAll?: () => Promise<void>; onOpen?: () => void; firstRead?: Promise<void> } = {}) {
  const onOpen = props.onOpen ?? vi.fn();
  const firstRead = props.firstRead ?? Promise.resolve();
  const rereadAll = props.rereadAll ?? (async () => undefined);
  const r = await render(<Harness firstRead={firstRead} rereadAll={rereadAll} onOpen={onOpen} gateKey={0} />);
  await flush();
  /** The crash screen's Try again: BootGate mounts again under the same App. */
  const remount = async (): Promise<void> => {
    await act(async () => {
      r.update(<Harness firstRead={firstRead} rereadAll={rereadAll} onOpen={onOpen} gateKey={1} />);
    });
    await flush();
  };
  return { r, onOpen, remount };
}

const tryAgain = async (root: ReactTestInstance): Promise<void> => {
  await press(buttonsNamed(root, m.tryAgain)[0] as ReactTestInstance);
  // The screen holds a try for its minimum busy time (motion.duration.crawl).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
  await flush();
};

beforeEach(() => {
  resetReadFailedTriesForTests();
  app.mockClear();
  flags.whoChooserEnabled = true;
  useProfileStore.setState({ profiles: [learner('p:a')], activeId: 'p:a', hydrated: true, loadFailed: null, listCopyKept: false });
  useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set(['p:a']), hydrate: realHydrate });
});

afterEach(() => {
  flags.whoChooserEnabled = chooserFlag;
  useProgressStore.setState({ hydrate: realHydrate });
});

describe('BootGate (section 3.4)', () => {
  it('nothing held: the app opens and the post-hydrate chain runs once', async () => {
    const { r, onOpen } = await boot();
    expect(screenTexts(r.root)).toContain(WELCOME);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('mounted again after the app opened (the crash screen), it opens at once: no second read, no second chain', async () => {
    const { r, onOpen, remount } = await boot();
    const decide = vi.spyOn(useProfileStore, 'getState');
    await remount();
    expect(screenTexts(r.root)).toContain(WELCOME);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(decide).not.toHaveBeenCalled();
    decide.mockRestore();
  });

  it('shows a blank canvas, never the app, until the first read has settled', async () => {
    let finish!: () => void;
    const firstRead = new Promise<void>((resolve) => {
      finish = resolve;
    });
    listFailed();
    const { r, onOpen } = await boot({ firstRead });
    expect(screenTexts(r.root)).toEqual([]);
    finish();
    await flush();
    expect(screenTexts(r.root)).toContain(m.title);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('a first read that rejected (another store) is decided from store state', async () => {
    const { r } = await boot({ firstRead: Promise.reject(new Error('the account record')) });
    expect(screenTexts(r.root)).toContain(WELCOME);
  });

  it('list failed: the screen, not Welcome; the chain does not run; no Choose another learner', async () => {
    listFailed('read');
    const { r, onOpen } = await boot();
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.title);
    expect(texts).not.toContain(WELCOME);
    expect(texts).not.toContain(m.chooseAnother);
    expect(app).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('list failed, damaged with a kept copy: still no Choose another learner (DP-1d adds the grown-up button)', async () => {
    listFailed('parse', true);
    const { r } = await boot();
    expect(screenTexts(r.root)).toContain(m.title);
    expect(screenTexts(r.root)).not.toContain(m.chooseAnother);
  });

  it('list: Try again reruns the full read; when the list reads the app opens and the chain runs once', async () => {
    listFailed('read');
    const rereadAll = vi.fn(async () => {
      useProfileStore.setState({ hydrated: true, profiles: [learner('p:a')], activeId: 'p:a', loadFailed: null });
    });
    const hydrate = vi.fn(async () => undefined);
    useProgressStore.setState({ hydrate });
    const { r, onOpen } = await boot({ rereadAll });
    await tryAgain(r.root);
    expect(rereadAll).toHaveBeenCalledTimes(1);
    expect(hydrate).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(WELCOME);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('list: a Try again that fails keeps the screen and the chain waiting', async () => {
    listFailed('read');
    const rereadAll = vi.fn(async () => undefined);
    const { r, onOpen } = await boot({ rereadAll });
    await tryAgain(r.root);
    expect(rereadAll).toHaveBeenCalledTimes(1);
    expect(screenTexts(r.root)).toContain(m.title);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('list reads on Try again but the active learner does not: the learner variant, with Choose another learner for 2', async () => {
    listFailed('read');
    const rereadAll = vi.fn(async () => {
      useProfileStore.setState({ hydrated: true, profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a', loadFailed: null });
      useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(['p:b']) });
    });
    const { r } = await boot({ rereadAll });
    expect(screenTexts(r.root)).not.toContain(m.chooseAnother);
    await tryAgain(r.root);
    expect(screenTexts(r.root)).toContain(m.title);
    expect(screenTexts(r.root)).toContain(m.chooseAnother);
  });

  it('active learner in loadFailedFor: the screen; Try again reruns that one hydrate and the app opens when it reads', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    const hydrate = vi.fn(async (id: string) => {
      useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set([id]) });
    });
    useProgressStore.setState({ hydrate });
    const rereadAll = vi.fn(async () => undefined);
    const { r, onOpen } = await boot({ rereadAll });
    expect(screenTexts(r.root)).toContain(m.title);
    expect(onOpen).not.toHaveBeenCalled();
    await tryAgain(r.root);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledWith('p:a');
    expect(rereadAll).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(WELCOME);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('while held, it follows store state: a learner read elsewhere (another tab, a re-read) opens the app', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    const { r, onOpen } = await boot();
    expect(screenTexts(r.root)).toContain(m.title);
    await act(async () => {
      useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set(['p:a']) });
    });
    await flush();
    expect(screenTexts(r.root)).toContain(WELCOME);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the held screen waits for the locale words, as the first screen does', async () => {
    listFailed();
    let settled!: () => void;
    const settle = new Promise<void>((resolve) => {
      settled = resolve;
    });
    const r = await render(
      <BootGate firstRead={Promise.resolve()} rereadAll={async () => undefined} settle={() => settle} opened={null} onOpen={vi.fn()}>
        {(open) => app(open)}
      </BootGate>,
    );
    await flush();
    expect(screenTexts(r.root)).toEqual([]);
    settled();
    await flush();
    expect(screenTexts(r.root)).toContain(m.title);
  });

  it('a learner who is not active does not hold the boot', async () => {
    useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a' });
    useProgressStore.setState({ loadFailedFor: new Set(['p:b']) });
    const { r } = await boot();
    expect(screenTexts(r.root)).toContain(WELCOME);
  });

  it('Choose another learner: shown with 2 learner profiles only; it opens the app on the chooser, the chain once', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    let booted = await boot();
    expect(screenTexts(booted.r.root)).not.toContain(m.chooseAnother);
    await unmount(booted.r);

    useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a' });
    booted = await boot();
    await press(buttonsNamed(booted.r.root, m.chooseAnother)[0] as ReactTestInstance);
    await flush();
    expect(screenTexts(booted.r.root)).toContain(`${WELCOME} + chooser`);
    expect(booted.onOpen).toHaveBeenCalledTimes(1);
  });

  it('Choose another learner is not offered with the chooser switched off', async () => {
    flags.whoChooserEnabled = false;
    useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a' });
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    const { r } = await boot();
    expect(screenTexts(r.root)).toContain(m.title);
    expect(screenTexts(r.root)).not.toContain(m.chooseAnother);
  });
});
