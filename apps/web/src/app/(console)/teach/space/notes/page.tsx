'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { colors, spacing } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { MoveButton, TransferSheet } from '@/components/console/TransferParts';
import { NOTES_CSS, NoteComposer, NotesTabs, SentList, type SentListState } from '@/components/console/NotesParts';
import { ReceivedPanel } from '@/components/console/FamilyNotesParts';
import { useConsole } from '@/components/console/use-console';
import { useNotesApi } from '@/components/console/use-notes-api';
import type { Roster } from '@/lib/console/api';
import { contentGatingEnabled, notesEnabled } from '@/lib/console/config';
import { spaceCoverage, type SpaceCoverage } from '@/lib/console/curriculum';
import { receivedLearner, viewerSendGrant } from '@/lib/console/family-notes';
import { questClosedLine, withdrawProblem, type SentNoteRow, type SentRowView } from '@/lib/console/notes';
import { FAMILY_TABS, notesPageHref, notesPageQuery, notesSender, questPrefill, type FamilyTab } from '@/lib/console/notes-page';
import { ROUTES, isKnownSpaceKind, spaceErrorText, spaceKindOfPath, type SpaceError } from '@/lib/console/routing';

/** The arrow-left glyph of the back link (design/screens/notes/README.md, Constants: 20 px on rows and lines). */
const BACK_GLYPH = 20;

/**
 * The notes page of a space (F-FEEDBACK-001 FB-11a, section 6.13; wireframes console/notes-sent.md,
 * console/note-composer.md and console/family-notes.md; screen specs design/screens/notes/sent-list.md, composer.md,
 * family-notes.md): `/teach/space/notes?id=<classId>` and its `/parent/space/notes` twin.
 *
 * A class reads its sent list with **New note**; a family reads the same rows on its **Sent** tab with **Send a note**,
 * and every note one learner received on its **Received** tab, the default (FB-12, `console/family-notes.md`; the
 * Learner select picks the learner, `&learner=`). `&compose=1` opens the composer sub-view over the list;
 * `&learner=` (an opaque id) filters the list and preselects that learner; `&quest=` prefills a catalogue quest.
 * Rendered only while `notesEnabled()`; off, the address goes back to the space page and nothing is asked of the
 * Worker. Sending also needs the Worker switch `NOTES_SEND`, which this page never changes.
 */
function NotesInner(): JSX.Element {
  const params = useSearchParams();
  const q = notesPageQuery(params);
  const pathKind = spaceKindOfPath(usePathname() ?? '');
  const router = useRouter();
  const { ready, session, api, signOut, m, locale } = useConsole();
  const notesApi = useNotesApi();
  const enabled = notesEnabled();
  const panelId = useId();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterError, setRosterError] = useState<SpaceError | null>(null);
  const [gating, setGating] = useState(false);
  const [coverage, setCoverage] = useState<SpaceCoverage>('unknown');
  // Whether this viewer's role sends here (section 6.1). Unknown (the spaces read failed) leaves the action in place:
  // the Worker decides, and the composer words its refusal.
  const [canSend, setCanSend] = useState(true);
  // A family caregiver's send grant (OD-17, FB-12): false only when the family's list says so; null (unknown) leaves
  // Send a note; undefined until the list answered, so a `&compose=1` arrival never opens the composer before it.
  const [grant, setGrant] = useState<boolean | null | undefined>(undefined);
  const [rows, setRows] = useState<SentNoteRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [listState, setListState] = useState<SentListState>('loading');
  const [olderBusy, setOlderBusy] = useState(false);
  const [takeBack, setTakeBack] = useState<{ view: SentRowView; name: string | null } | null>(null);
  const [takeBackBusy, setTakeBackBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Only the newest list read may draw: an answer for an older filter or an earlier retry is dropped.
  const latest = useRef(0);
  // The composer opened from this page's own New note: closing it goes back, so history keeps one copy of the list.
  const openedHere = useRef(false);

  useEffect(() => {
    if (!enabled) router.replace(ROUTES.space(q.spaceId, pathKind));
  }, [enabled, router, q.spaceId, pathKind]);

  // Schools have no notes page (section 6.13): the address goes to the school's own page.
  const [school, setSchool] = useState(false);
  useEffect(() => {
    if (school) router.replace(ROUTES.space(q.spaceId, 'school'));
  }, [school, router, q.spaceId]);

  const loadRoster = useCallback(async (): Promise<void> => {
    if (!api || !enabled) return;
    setRosterError(null);
    // The closed-quest mark needs the free-plan switch and this viewer's view of the space's plan (F-ENT-003); the
    // spaces read also gives this viewer's role, which decides whether the page offers sending at all.
    const gate = contentGatingEnabled();
    setGating(gate);
    const [result, spaces, entitlements] = await Promise.all([api.roster(q.spaceId), api.listSpaces(), gate ? api.entitlements() : null]);
    if (!result.ok) {
      setRosterError(result.error === 'forbidden' ? 'forbidden' : result.error === 'not_found' ? 'gone' : 'cantReach');
      return;
    }
    if (!isKnownSpaceKind(result.data.space.kind)) {
      setRosterError('cantReach');
      return;
    }
    // Schools have no notes page (section 6.13): the address goes to the school's own page.
    if (result.data.space.kind === 'school') {
      setSchool(true);
      return;
    }
    if (spaces.ok) {
      const mine = spaces.data.find((item) => item.space.id === result.data.space.id);
      setCanSend(mine ? notesSender(mine.role, result.data.space.kind) : true);
    }
    setRoster(result.data);
    if (gate) setCoverage(spaceCoverage(entitlements?.ok ? entitlements.data : null, spaces?.ok ? spaces.data : null, result.data.space, new Date()));
  }, [api, enabled, q.spaceId]);

  // The list waits for the roster: a school, a space this viewer cannot open or one that is gone never asks for it.
  // A family reads its sent list on the Sent tab only; the Received tab reads its own (FB-12).
  const rosterKind = roster?.space.kind ?? null;
  const loadList = useCallback(async (): Promise<void> => {
    if (!notesApi || !enabled || rosterKind === null || (rosterKind === 'family' && q.tab !== 'sent')) return;
    const call = ++latest.current;
    setListState('loading');
    setRows([]);
    const result = await notesApi.sent(q.spaceId, { learner: q.learner ?? undefined });
    if (call !== latest.current) return;
    if (result.ok) {
      setRows(result.data.rows);
      setNext(result.data.next);
      setListState('ready');
    } else setListState('error');
  }, [notesApi, enabled, rosterKind, q.spaceId, q.learner, q.tab]);

  // Who may send in this family (panel D's list, readable by every caregiver): a caregiver without the grant sees why.
  const accountId = session?.accountId ?? '';
  useEffect(() => {
    if (!notesApi || !enabled || rosterKind !== 'family') return;
    let live = true;
    void notesApi.noteSenders(q.spaceId).then((result) => {
      if (live) setGrant(viewerSendGrant(result.ok ? result.data : null, accountId));
    });
    return () => {
      live = false;
    };
  }, [notesApi, enabled, rosterKind, q.spaceId, accountId]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  if (!ready || !session || !enabled || school) return <AdultFrame>{null}</AdultFrame>;

  const n = m.console.notes;
  const kind = roster?.space.kind ?? pathKind ?? 'class';
  const family = kind === 'family';
  const side = family ? 'family' : 'class';
  const tab: FamilyTab | undefined = family ? q.tab : undefined;
  // One learner at a time on the Received tab (wireframe A); a family with no learners has no tabs at all.
  const familyLearners = family && roster ? roster.learners : [];
  const shown = receivedLearner(familyLearners, q.learner);
  const noLearners = family && roster !== null && familyLearners.length === 0;
  // Send a note stays in place for a caregiver without the grant, unavailable and described by why (screen spec, States).
  const notGranted = family && grant === false;

  const openComposer = (): void => {
    openedHere.current = true;
    router.push(notesPageHref(q.spaceId, kind, { learner: q.learner, compose: true, tab }));
  };
  // Opened here: back to the list entry New note pushed over. Arrived with `&compose=1` (the roster, the report, the
  // family home): replace, so the list is where Back from it leads.
  const closeComposer = (sent: boolean): void => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else router.replace(notesPageHref(q.spaceId, kind, { learner: q.learner, tab }));
    if (sent) void loadList();
  };
  const filter = (learner: string): void => router.replace(notesPageHref(q.spaceId, kind, { learner: learner || null, tab }));

  const older = async (): Promise<void> => {
    if (!notesApi || next === null || olderBusy) return;
    const call = latest.current;
    setOlderBusy(true);
    const result = await notesApi.sent(q.spaceId, { before: next, learner: q.learner ?? undefined });
    setOlderBusy(false);
    if (call !== latest.current) return;
    if (result.ok) {
      setRows((now) => [...now, ...result.data.rows]);
      setNext(result.data.next);
    } else setNotice(n.sent.error);
  };

  const confirmTakeBack = async (): Promise<void> => {
    if (!notesApi || !takeBack?.view.noteId || takeBackBusy) return;
    setTakeBackBusy(true);
    const result = await notesApi.withdraw(q.spaceId, takeBack.view.noteId, takeBack.view.batch);
    setTakeBackBusy(false);
    setTakeBack(null);
    setNotice(result.ok ? null : withdrawProblem(result.failure, locale));
    void loadList();
  };

  const title = family || !roster ? n.family.title : n.sent.title(roster.space.name);
  const list = (
    <>
      {notice ? (
        <p className="hr-notes-problem" role="status">
          {notice}
        </p>
      ) : null}
      {!family ? <p className="hr-notes-quiet">{n.sent.disclosure}</p> : null}
      {roster && roster.learners.length > 0 ? (
        <label className="hr-notes-field-inline">
          {n.sent.filter.label}
          <select className="hr-notes-select" data-testid="notes-filter" value={q.learner ?? ''} onChange={(event) => filter(event.target.value)}>
            <option value="">{n.sent.filter.everyone}</option>
            {roster.learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <SentList
        state={listState}
        rows={rows}
        hasMore={next !== null}
        olderBusy={olderBusy}
        kind={kind}
        m={m}
        locale={locale}
        onRetry={() => void loadList()}
        onOlder={() => void older()}
        onTakeBack={(view, raw) => {
          setNotice(null);
          setTakeBack({ view, name: raw.to === 'learner' ? raw.displayName : null });
        }}
        onNewNote={canSend && !rosterError ? openComposer : undefined}
      />
    </>
  );

  return (
    <AdultFrame onSignOut={signOut}>
      <style>{NOTES_CSS}</style>
      <div className="hr-notes">
        <Link className="hr-notes-back" href={ROUTES.space(q.spaceId, kind)}>
          <IconSvg name="arrow-left" size={BACK_GLYPH} color={colors.brand.secondaryDark} />
          {n.sent.back[side]}
        </Link>
        <div className="hr-notes-head">
          <h1>{title}</h1>
          {canSend && !rosterError && !noLearners ? (
            <button
              type="button"
              className="hr-notes-btn hr-notes-primary"
              onClick={notGranted ? undefined : openComposer}
              aria-disabled={notGranted || undefined}
              aria-describedby={notGranted ? `${panelId}-not-granted` : undefined}
              data-testid="notes-new"
            >
              {family ? n.sendNote.cta : n.newNote.cta}
            </button>
          ) : null}
        </div>
        {notGranted && !rosterError && !noLearners ? (
          <p className="hr-notes-quiet" id={`${panelId}-not-granted`}>
            {n.composer.errors.notAllowed}
          </p>
        ) : null}
        {rosterError ? (
          <div className="hr-notes-state" role="alert">
            <p>{spaceErrorText(rosterError, locale)}</p>
            {rosterError === 'cantReach' ? (
              <button type="button" className="hr-notes-btn" onClick={() => void loadRoster()}>
                {m.console.tryAgain}
              </button>
            ) : null}
          </div>
        ) : null}
        {rosterError ? null : noLearners ? (
          <div className="hr-notes-state">
            <p>{n.family.noLearners}</p>
          </div>
        ) : family ? (
          <>
            {q.tab === 'received' && familyLearners.length > 1 && shown ? (
              <label className="hr-notes-field-inline">
                {n.family.learner}
                <select
                  className="hr-notes-select"
                  data-testid="notes-learner"
                  value={shown.id}
                  onChange={(event) => router.replace(notesPageHref(q.spaceId, kind, { learner: event.target.value, tab: q.tab }))}
                >
                  {familyLearners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <NotesTabs<FamilyTab>
              tabs={FAMILY_TABS}
              current={q.tab}
              label={n.family.tabs.label}
              labelOf={(t) => n.family.tabs[t]}
              panelId={panelId}
              onSelect={(t) => router.replace(notesPageHref(q.spaceId, kind, { learner: q.learner, tab: t }))}
            />
            <div className="hr-notes-panel" role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${q.tab}`}>
              {q.tab === 'sent' ? list : shown && notesApi && roster ? <ReceivedPanel key={shown.id} notesApi={notesApi} familyId={roster.space.id} learner={shown} m={m} locale={locale} /> : null}
            </div>
          </>
        ) : (
          <div className="hr-notes-panel">{list}</div>
        )}
      </div>
      {q.compose && roster && notesApi && canSend && (!family || grant !== undefined) && !notGranted ? (
        <NoteComposer
          notesApi={notesApi}
          space={{ id: roster.space.id, kind: roster.space.kind, name: roster.space.name, archived: roster.space.archivedAt !== null }}
          prefillLearner={q.learner}
          prefillQuest={questPrefill(q.quest)}
          closedLine={(questId) => questClosedLine(questId, { gating, coverage }, locale)}
          m={m}
          locale={locale}
          onClose={closeComposer}
        />
      ) : null}
      {takeBack ? (
        <TransferSheet title={n.sent.takeBack.title} onClose={() => setTakeBack(null)} closeLabel={n.composer.close} testId="take-back-sheet">
          <p style={{ margin: 0 }}>{takeBack.view.batch || takeBack.name === null ? n.sent.takeBack.bodyEveryone : n.sent.takeBack.body(takeBack.name)}</p>
          <div className="hr-compose-actions" style={{ marginTop: spacing.lg }}>
            <MoveButton primary waiting={takeBackBusy} onClick={() => void confirmTakeBack()}>
              {n.sent.takeBack.confirm.cta}
            </MoveButton>
            <MoveButton onClick={() => setTakeBack(null)}>{n.sent.takeBack.cancel.cta}</MoveButton>
          </div>
        </TransferSheet>
      ) : null}
    </AdultFrame>
  );
}

export default function NotesPage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <NotesInner />
    </Suspense>
  );
}
