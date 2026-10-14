import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProgressStore } from '../../../store/progress-store';
import { cardsDispatch, learnerCardsPorts, previewCardsPorts, type CardsSessionPorts } from '../cards-ports';
import { cardsCompleteEvent, cardsStartEvent, initCardsFlash } from '../cards-view';
import { cardsSessionEvent, quickCheckEvent, type FlashEvent, type FlashState } from '../flashcards';

/**
 * F-BROWSE-001 BR-9b (section 4.7, vocabulary topic): the F-VOC-003 flashcards run in
 * All lessons through `MinigameHost` mode `'preview'` and save nothing. Everything the
 * flashcard session does to a learner's record (the F-VOC-005 vocabulary progress slice
 * through `recordVocab`, the reading practice switch on the profile) and every learner
 * event goes through `CardsSessionPorts`; the preview ports drop all of it. The screen
 * has no renderer harness, so its seam is read from source; the rendered preview is held
 * by `browse.spec.ts`, which compares the device before and after.
 */

const words = [
  { id: 'vocab:apple', level: 1 as const },
  { id: 'vocab:milk', level: 1 as const },
];

/** A whole chunk the way a learner turns it: flip, hear, Show me again, flip, Got it, and on to the check. */
const RUN: readonly FlashEvent[] = ['flip', 'hear', 'again', 'flip', 'got-it', 'flip', 'got-it', 'check-done'];

function play(ports: CardsSessionPorts): FlashState {
  let state = initCardsFlash(words, null);
  for (const event of RUN) state = cardsDispatch(ports, state, event);
  // The quick check's first answer and the summary's session, as the screen writes them.
  ports.write([quickCheckEvent('vocab:apple', true)]);
  ports.write([cardsSessionEvent('food')]);
  ports.track(cardsStartEvent({ topicKey: 'food', chunk: 0, chunks: 1, words: 2, level: null }));
  ports.track(cardsCompleteEvent({ topicKey: 'food', chunk: 0, tally: { words: 2, gotIt: 2, again: 1, heard: 1, newlyCollected: 2 }, checkFirstTry: 1, checkQuestions: 2 }));
  return state;
}

afterEach(() => vi.restoreAllMocks());

describe('previewCardsPorts (All lessons, host mode preview)', () => {
  it('runs the flashcards in the preview host mode, for nobody, with no reading practice switch', () => {
    const ports = previewCardsPorts();
    expect(ports.hostMode).toBe('preview');
    expect(ports.profileId).toBeNull();
    expect(ports.readingPractice).toBe(false);
  });

  it('a whole chunk, its check and its summary write no vocabulary progress, touch no profile and send no event', () => {
    const progressBefore = useProgressStore.getState();
    const record = vi.spyOn(useProgressStore.getState(), 'recordVocab');
    const state = play(previewCardsPorts());
    // The cards still move as the learner's do: the preview is the learner screen.
    expect(state.phase).toBe('done');
    expect(record).not.toHaveBeenCalled();
    expect(useProgressStore.getState().byProfile).toBe(progressBefore.byProfile);
  });
});

describe('learnerCardsPorts (the learner app, unchanged)', () => {
  it('writes each event for the active profile and sends the events with it', () => {
    const record = vi.fn();
    const track = vi.fn();
    const ports = learnerCardsPorts({ profileId: 'p1', record, track });
    expect(ports.hostMode).toBe('vocab');
    expect(ports.readingPractice).toBe(true);
    const state = play(ports);
    expect(state.phase).toBe('done');
    const written = record.mock.calls.flatMap(([id, events]) => {
      expect(id).toBe('p1');
      return events as { type: string }[];
    });
    expect(written.map((e) => e.type)).toEqual(['introduced', 'self', 'introduced', 'self', 'self', 'answer', 'session']);
    expect(track.mock.calls.map(([e]) => [e.name, e.profileId])).toEqual([
      ['vocab.cards.start', 'p1'],
      ['vocab.cards.complete', 'p1'],
    ]);
  });

  it('with no active profile writes nothing and sends the events with no one named', () => {
    const record = vi.fn();
    const track = vi.fn();
    play(learnerCardsPorts({ profileId: null, record, track }));
    expect(record).not.toHaveBeenCalled();
    expect(track.mock.calls.map(([e]) => e.profileId)).toEqual([undefined, undefined]);
  });

  it('an event that changes nothing is not written', () => {
    const record = vi.fn();
    const ports = learnerCardsPorts({ profileId: 'p1', record, track: vi.fn() });
    const start = initCardsFlash(words, null);
    // Got it on a front face does nothing.
    expect(cardsDispatch(ports, start, 'got-it')).toBe(start);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('the flashcard screen keeps to its ports', () => {
  const source = readFileSync(resolve(__dirname, '../../../screens/vocab/VocabCardsScreen.tsx'), 'utf8');
  const session = source.slice(source.indexOf('export function CardsSession'));

  it('the session writes and tracks only through the ports, and its check runs in the ports host mode', () => {
    expect(session).not.toMatch(/recordVocab\(/);
    expect(session).not.toMatch(/(^|[^.\w])track\(/m);
    expect(session).toMatch(/mode: ports\.hostMode/);
  });

  it('the reading practice switch (a profile write) is drawn only for the profile the ports offer it to', () => {
    const body = session.slice(0, session.indexOf('function CardsPhase'));
    expect(body).toMatch(/readingPractice=\{ports\.readingPractice \? profile : null\}/);
    const phase = session.slice(session.indexOf('function CardsPhase'), session.indexOf('function CheckQuestion'));
    // The one profile write sits inside the switch, which draws only with an offered profile.
    expect(phase).toMatch(/readingPractice: profile,/);
    expect(phase.indexOf('{profile ? (')).toBeGreaterThan(-1);
    expect(phase.indexOf('setMode(profile.id')).toBeGreaterThan(phase.indexOf('{profile ? ('));
    expect(phase).not.toMatch(/useProfileStore/);
  });
});
