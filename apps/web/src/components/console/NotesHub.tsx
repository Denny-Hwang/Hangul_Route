'use client';

import type { AdultPersona } from '@hangul-route/content-schema';
import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { colors } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import type { SpaceListItem } from '@/lib/console/api';
import { notesEnabled } from '@/lib/console/config';
import { notesHubView } from '@/lib/console/notes-page';
import { personaHome } from '@/lib/console/personas';
import { AdultFrame } from './AdultFrame';
import { NOTES_CSS } from './NotesParts';
import { useConsole } from './use-console';

/** The chevron on a row's Notes link (design/screens/notes/README.md, Constants: 20 px on rows). */
const GLYPH_ROW = 20;

/**
 * The notes hub of a persona (F-FEEDBACK-001 FB-11b, section 6.13 entry 1; wireframe console/notes-hub.md; screen spec
 * design/screens/notes/notes-hub.md): `/parent/notes` and `/teach/notes`, the adult nav's Notes items. With one space
 * of that persona the address is replaced by its notes page (the hub never stays in history); with several, one row
 * per space with **Notes** (API order, no counts); with none, how to start. Off with `notesEnabled()`: the persona
 * home, and nothing is asked of the Worker.
 */
export function NotesHub({ persona }: { persona: AdultPersona }): JSX.Element {
  const router = useRouter();
  const { ready, session, api, signOut, m } = useConsole();
  const enabled = notesEnabled();
  const ids = useId();
  const [spaces, setSpaces] = useState<SpaceListItem[] | 'failed' | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!api || !enabled) return;
    setSpaces(null);
    const result = await api.listSpaces();
    setSpaces(result.ok ? result.data : 'failed');
  }, [api, enabled]);

  useEffect(() => {
    if (!enabled) router.replace(personaHome(persona));
  }, [enabled, router, persona]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = Array.isArray(spaces) ? notesHubView(spaces, persona) : null;
  const redirect = view?.kind === 'redirect' ? view.href : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (!ready || !session || !enabled || redirect) return <AdultFrame>{null}</AdultFrame>;
  const hub = m.console.notes.hub;

  return (
    <AdultFrame onSignOut={signOut}>
      <style>{NOTES_CSS}</style>
      <div className="hr-notes">
        <h1 className="hr-notes-hub-title">{hub.title}</h1>
        {spaces === null ? (
          <div className="hr-notes-rows" aria-busy="true" data-testid="hub-loading">
            <div className="hr-notes-skeleton" />
            <div className="hr-notes-skeleton" />
          </div>
        ) : spaces === 'failed' ? (
          <div className="hr-notes-state" role="alert">
            <p>{hub.error}</p>
            <button type="button" className="hr-notes-btn" onClick={() => void load()}>
              {hub.retry.cta}
            </button>
          </div>
        ) : view?.kind === 'none' ? (
          <div className="hr-notes-state">
            <p>{hub.none[persona]}</p>
            <Link className="hr-notes-btn hr-notes-primary" href={view.start}>
              {hub.start.cta}
            </Link>
          </div>
        ) : view?.kind === 'list' ? (
          <ul className="hr-notes-rows">
            {view.rows.map((row, index) => (
              <li key={row.id} className="hr-notes-card hr-notes-hub-row">
                <span className="hr-notes-to" id={`${ids}-space-${index}`}>
                  {row.name}
                </span>
                <Link className="hr-notes-btn" href={row.href} aria-describedby={`${ids}-space-${index}`}>
                  {hub.open.cta}
                  <IconSvg name="arrow-right" size={GLYPH_ROW} color={colors.text.primary} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AdultFrame>
  );
}
