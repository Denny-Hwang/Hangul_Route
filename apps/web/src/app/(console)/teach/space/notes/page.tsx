'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { colors, spacing } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { AdultFrame } from '@/components/console/AdultFrame';
import { MoveButton, TransferSheet } from '@/components/console/TransferParts';
import { NOTES_CSS, NoteComposer, NotesTabs, SentList, type SentListState } from '@/components/console/NotesParts';
import { useConsole } from '@/components/console/use-console';
import { useNotesApi } from '@/components/console/use-notes-api';
import type { Roster } from '@/lib/console/api';
import { contentGatingEnabled, notesEnabled } from '@/lib/console/config';
import { spaceCoverage, type SpaceCoverage } from '@/lib/console/curriculum';
import { questClosedLine, withdrawProblem, type SentNoteRow, type SentRowView } from '@/lib/console/notes';
import { FAMILY_TABS, notesPageHref, notesPageQuery, questPrefill, type FamilyTab } from '@/lib/console/notes-page';
import { ROUTES, isKnownSpaceKind, spaceErrorText, spaceKindOfPath, type SpaceError } from '@/lib/console/routing';

/** The arrow-left glyph of the back link (design/screens/notes/README.md, Constants: 20 px on rows and lines). */
const BACK_GLYPH = 20;

/**
 * The notes page of a space (F-FEEDBACK-001 FB-11a, section 6.13; wireframes console/notes-sent.md,
 * console/note-composer.md and console/family-notes.md; screen specs design/screens/notes/sent-list.md, composer.md,
 * family-notes.md): `/teach/space/notes?id=<classId>` and its `/parent/space/notes` twin.
 *
 * A class reads its sent list with **New note**; a family reads the same rows on its **Sent** tab with **Send a note**
 * (FB-12 adds the Received tab, the family default). `&compose=1` opens the composer sub-view over the list;
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
  const [rows, setRows] = useState<SentNoteRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [listState, setListState] = useState<SentListState>('loading');
  const [olderBusy, setOlderBusy] = useState(false);
  const [takeBack, setTakeBack] = useState<{ view: SentRowView; name: string | null } | null>(null);
  const [takeBackBusy, setTakeBackBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Only the newest list read may draw: an answer for an older filter or an earlier retry is dropped.
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) router.replace(ROUTES.space(q.spaceId, pathKind));
  }, [enabled, router, q.spaceId, pathKind]);

  const loadRoster = useCallback(async (): Promise<void> => {
    if (!api || !enabled) return;
    setRosterError(null);
    // The closed-quest mark needs the free-plan switch and this viewer's view of the space's plan (F-ENT-003).
    const gate = contentGatingEnabled();
    setGating(gate);
    const [result, spaces, entitlements] = await Promise.all([api.roster(q.spaceId), gate ? api.listSpaces() : null, gate ? api.entitlements() : null]);
    if (!result.ok) {
      setRosterError(result.error === 'forbidden' ? 'forbidden' : result.error === 'not_found' ? 'gone' : 'cantReach');
      return;
    }
    if (!isKnownSpaceKind(result.data.space.kind)) {
      setRosterError('cantReach');
      return;
    }
    setRoster(result.data);
    if (gate) setCoverage(spaceCoverage(entitlements?.ok ? entitlements.data : null, spaces?.ok ? spaces.data : null, result.data.space, new Date()));
  }, [api, enabled, q.spaceId]);

  const loadList = useCallback(async (): Promise<void> => {
    if (!notesApi || !enabled) return;
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
  }, [notesApi, enabled, q.spaceId, q.learner]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  if (!ready || !session || !enabled) return <AdultFrame>{null}</AdultFrame>;

  const n = m.console.notes;
  const kind = roster?.space.kind ?? pathKind ?? 'class';
  const family = kind === 'family';
  const side = family ? 'family' : 'class';
  const tab: FamilyTab | undefined = family ? q.tab : undefined;

  const openComposer = (): void => router.push(notesPageHref(q.spaceId, kind, { learner: q.learner, compose: true, tab }));
  const closeComposer = (sent: boolean): void => {
    router.replace(notesPageHref(q.spaceId, kind, { learner: q.learner, tab }));
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
        onNewNote={openComposer}
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
          <button type="button" className="hr-notes-btn hr-notes-primary" onClick={openComposer} data-testid="notes-new">
            {family ? n.sendNote.cta : n.newNote.cta}
          </button>
        </div>
        {rosterError ? (
          <div className="hr-notes-state" role="alert">
            <p>{spaceErrorText(rosterError, locale)}</p>
            <button type="button" className="hr-notes-btn" onClick={() => void loadRoster()}>
              {m.console.tryAgain}
            </button>
          </div>
        ) : null}
        {family ? (
          <>
            <NotesTabs<FamilyTab>
              tabs={FAMILY_TABS}
              current={q.tab}
              label={n.family.tabs.label}
              labelOf={(t) => n.family.tabs[t]}
              panelId={panelId}
              onSelect={(t) => router.replace(notesPageHref(q.spaceId, kind, { learner: q.learner, tab: t }))}
            />
            <div className="hr-notes-panel" role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${q.tab}`}>
              {list}
            </div>
          </>
        ) : (
          <div className="hr-notes-panel">{list}</div>
        )}
      </div>
      {q.compose && roster && notesApi ? (
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
