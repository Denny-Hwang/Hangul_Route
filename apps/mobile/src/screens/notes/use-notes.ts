import type { LearnerMembership } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { episodesAll, questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { suggestStartTarget } from '../../logic/notes/screens';
import type { NotesData } from '../../logic/notes/types';
import type { NotesViewContext } from '../../logic/notes/view';
import { useMembershipStore } from '../../store/membership-store';
import { useNotesStore } from '../../store/notes-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';

const NO_MEMBERSHIPS: readonly LearnerMembership[] = [];
const QUEST_IDS: ReadonlySet<string> = new Set(questsAll.map((q) => q.id));

/** Whether this build can show and start a suggested quest: the catalogue has it and an openable episode lists it. */
export const questKnown = (questId: string): boolean => QUEST_IDS.has(questId) && suggestStartTarget(questId, episodesAll) !== null;

export interface ActiveNotes {
  profileId: string | null;
  /** The active profile's notes record; undefined until the store has read it. */
  data: NotesData | undefined;
  /** `error`: the stored record could not be read (the list and the page offer Try again). */
  status: 'loading' | 'ready' | 'error';
  retry: () => void;
  ctx: NotesViewContext;
  /** The profile's class and family memberships (the My notes row condition). */
  memberships: readonly LearnerMembership[];
}

/**
 * The active profile's notes for the learner screens (F-FEEDBACK-001 FB-8): reads the notes store
 * (hydrating it once per profile) and the memberships, and builds the view context of
 * `logic/notes/view.ts`. Notes are per profile: a profile switch changes everything here.
 */
export function useActiveNotes(): ActiveNotes {
  const m = useMessages();
  const locale = useLocale();
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;
  const data = useNotesStore((s) => (profileId === null ? undefined : s.byProfile[profileId]));
  const memberships = useMembershipStore((s) => (profileId === null ? undefined : s.byLearner[profileId])) ?? NO_MEMBERSHIPS;
  const [status, setStatus] = useState<ActiveNotes['status']>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (profileId === null) return undefined;
    let alive = true;
    setStatus('loading');
    void useMembershipStore.getState().hydrate(profileId).catch(() => undefined);
    useNotesStore
      .getState()
      .hydrate(profileId)
      .then(
        () => alive && setStatus('ready'),
        () => alive && setStatus('error'),
      );
    return () => {
      alive = false;
    };
  }, [profileId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const learnerType = profile?.learnerType;
  const ctx = useMemo(
    (): NotesViewContext => ({ m, locale, memberships, learnerType, now: new Date(), questKnown }),
    // `data` re-reads the clock, so "Today" follows the day the notes changed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m, locale, memberships, learnerType, data],
  );

  return { profileId, data, status: data !== undefined && status === 'loading' ? 'ready' : status, retry, ctx, memberships };
}
