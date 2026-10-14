import type { TelemetryEvent } from '../../platform/telemetry';
import { flashEvents, flashReducer, type FlashEvent, type FlashState } from './flashcards';
import type { VocabEvent } from './progress';

/**
 * The flashcard session's seam to a learner's record (F-VOC-003 C-5; F-BROWSE-001 section 4.7,
 * BR-9b). `CardsSession` turns the cards, runs the quick check and shows the summary; every
 * vocabulary write (the F-VOC-005 progress slice through `recordVocab`), every learner event and
 * the reading practice switch (a profile setting) go through these ports. The learner app wires
 * them to today's behaviour; All lessons wires them to ports that save nothing, with the quick
 * check in `MinigameHost` mode `'preview'` (the only use of that mode).
 */
export interface CardsSessionPorts {
  /** The quick check's host mode: `'vocab'` for a learner, `'preview'` in All lessons. */
  hostMode: 'vocab' | 'preview';
  /** Whose words these are: the active profile, or `null` (no profile; a preview is nobody's). */
  profileId: string | null;
  /** Whether the reading practice switch (the profile's own setting) is offered. */
  readingPractice: boolean;
  /** Write vocabulary events as they happen (section 3.6). */
  write(events: readonly VocabEvent[]): void;
  /** A flashcard event; the session never names a person (the ports add who, if anyone). */
  track(event: CardsEvent): void;
}

export type CardsEvent = Omit<TelemetryEvent, 'profileId'>;

export interface LearnerCardsDeps {
  profileId: string | null;
  record: (profileId: string, events: readonly VocabEvent[]) => void;
  track: (event: TelemetryEvent) => unknown;
}

/** The learner's ports: each event written for the active profile (none without one), events sent with it. */
export function learnerCardsPorts(deps: LearnerCardsDeps): CardsSessionPorts {
  const { profileId } = deps;
  return {
    hostMode: 'vocab',
    profileId,
    readingPractice: true,
    write: (events) => {
      if (profileId === null || events.length === 0) return;
      deps.record(profileId, events);
    },
    track: (event) => {
      void deps.track({ ...event, profileId: profileId ?? undefined });
    },
  };
}

/**
 * The All lessons ports (BR-9b): the flashcards as a learner sees them, for nobody. Nothing is
 * written (no vocabulary progress, no profile setting) and nothing is sent; the browse write and
 * telemetry fences would refuse both anyway (section 4.10).
 */
export function previewCardsPorts(): CardsSessionPorts {
  return {
    hostMode: 'preview',
    profileId: null,
    readingPractice: false,
    write: () => undefined,
    track: () => undefined,
  };
}

/** One card event: the next state, its vocabulary events written through the ports first. */
export function cardsDispatch(ports: Pick<CardsSessionPorts, 'write'>, before: FlashState, event: FlashEvent): FlashState {
  const next = flashReducer(before, event);
  if (next === before) return before;
  ports.write(flashEvents(before, event));
  return next;
}
