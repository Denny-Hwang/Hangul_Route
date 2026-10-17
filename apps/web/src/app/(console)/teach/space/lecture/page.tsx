'use client';

import { type LectureBlock, type RomanizationMode, type UiLocale } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LectureCatalogueSection,
  LectureOptionsSection,
  LectureOutlineSection,
  LecturePickerSection,
  LectureSourceSection,
  lectureH2Style,
  lectureSectionStyle,
  type LectureOptionValues,
} from '@/components/console/LectureParts';
import { Button, Field, Muted, Notice } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConsole } from '@/components/console/use-console';
import type { PlanView, Roster } from '@/lib/console/api';
import { appUrl, lectureModeEnabled } from '@/lib/console/config';
import {
  classCodeBlock,
  deckPicker,
  lecturePlanFrom,
  lectureSourceFrom,
  outlineProblem,
  pickPlan,
  pickerChoices,
  planOutline,
  presenterLink,
  revisitBlock,
  rosterMessage,
  titleProblem,
  type LectureSource,
  type PickerChoice,
} from '@/lib/console/lecture';
import { answerReady, appOriginOf, openPresenter, type OpenedDeck } from '@/lib/console/lecture-link';
import { dateKey } from '@/lib/console/plans';
import { classRollup } from '@/lib/console/rollup';
import { ROUTES, type SpaceError, spaceErrorText, spaceIdFrom } from '@/lib/console/routing';
import { useConsoleLocale } from '@/lib/i18n/locale-context';

const TITLE_MAX = 60;

/** A window this page opened is dropped once the teacher closes it (with its roster labels). */
function pruneClosed(opened: Map<unknown, OpenedDeck>): void {
  for (const win of opened.keys()) {
    if (typeof win === 'object' && win !== null && (win as { closed?: unknown }).closed === true) opened.delete(win);
  }
}

/** console/lecture-setup — F-TCH-004 §3.11, wireframe `classroom/lecture-presenter.md` screen K. */
function LectureInner(): JSX.Element {
  const params = useSearchParams();
  const spaceId = spaceIdFrom(params);
  const preselected = lectureSourceFrom(params);
  const planParam = lecturePlanFrom(params);
  const { ready, session, api, signOut, m, locale } = useConsole();
  const { available } = useConsoleLocale();
  const c = m.console;
  const l = c.lecture;
  const enabled = lectureModeEnabled();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [plansFailed, setPlansFailed] = useState(false);
  const [error, setError] = useState<SpaceError | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<LectureSource>('catalogue');
  const [blocks, setBlocks] = useState<LectureBlock[]>([]);
  const [omitted, setOmitted] = useState(0);
  const [edited, setEdited] = useState(false);
  const [title, setTitle] = useState('');
  const [romanization, setRomanization] = useState<RomanizationMode>('always');
  const [strokeGuide, setStrokeGuide] = useState(true);
  const [sound, setSound] = useState(true);
  const [uiLocale, setUiLocale] = useState<UiLocale | null>(null);
  const [picker, setPicker] = useState<PickerChoice>('numbers');
  const [notice, setNotice] = useState<'blocked' | 'copyFailed' | 'linkFailed' | null>(null);
  const [copied, setCopied] = useState(false);
  // The presenter tabs this page opened, each with its deck and roster: the only windows a `ready` is answered for.
  const opened = useRef(new Map<unknown, OpenedDeck>());
  const now = useMemo(() => new Date(), []);

  const rollup = roster ? classRollup(roster.learners, now) : null;
  const revisit = rollup ? revisitBlock(rollup.revisit) : null;
  const presenterLocale = uiLocale ?? locale;

  const choose = useCallback((next: LectureSource, from: { plan: PlanView | null; revisit: LectureBlock | null }): void => {
    setSource(next);
    setEdited(false);
    setOmitted(0);
    if (next === 'plan' && from.plan) {
      const outline = planOutline(from.plan, dateKey(new Date()));
      setBlocks(outline.blocks);
      setOmitted(outline.omitted);
      setTitle(from.plan.title.slice(0, TITLE_MAX));
    } else if (next === 'revisit' && from.revisit) {
      setBlocks([from.revisit]);
      setTitle('');
    } else {
      setBlocks([]);
      setTitle('');
    }
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!api || !enabled) return;
    setError(null);
    setLoading(true);
    const [rosterRes, plansRes] = await Promise.all([api.roster(spaceId), api.listPlans(spaceId)]);
    setLoading(false);
    if (!rosterRes.ok) {
      setError(rosterRes.error === 'forbidden' ? 'forbidden' : rosterRes.error === 'not_found' ? 'gone' : 'cantReach');
      return;
    }
    const chosen = plansRes.ok ? pickPlan(plansRes.data, planParam) : null;
    const revisitNow = revisitBlock(classRollup(rosterRes.data.learners, new Date()).revisit);
    setRoster(rosterRes.data);
    setPlan(chosen);
    setPlansFailed(!plansRes.ok);
    setPicker(pickerChoices(rosterRes.data).initial);
    const start: LectureSource = preselected === 'revisit' && revisitNow ? 'revisit' : chosen && preselected !== 'revisit' ? 'plan' : 'catalogue';
    choose(start, { plan: chosen, revisit: revisitNow });
  }, [api, enabled, spaceId, planParam, preselected, choose]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const origin = appOriginOf(appUrl());
    const onMessage = (event: MessageEvent): void => {
      pruneClosed(opened.current);
      answerReady({ origin: event.origin, source: event.source, data: event.data }, { appOrigin: origin, opened: opened.current });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // "Link copied" describes the deck that was copied: any change to it clears the label.
  useEffect(() => {
    setCopied(false);
  }, [title, blocks, romanization, strokeGuide, sound, presenterLocale, picker]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  const back = (
    <Muted>
      <Link href={ROUTES.space(spaceId, roster?.space.kind)}>{l.back(roster?.space.name ?? null)}</Link>
    </Muted>
  );

  if (!enabled) {
    return (
      <AdultFrame onSignOut={signOut} title={l.title}>
        {back}
        <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.xs}px` }}>{l.title}</h1>
        <Notice>{l.comingSoon}</Notice>
      </AdultFrame>
    );
  }

  const problem = roster ? titleProblem(title, roster) : 'empty';
  const choices = roster ? pickerChoices(roster) : null;
  const canPresent = roster !== null && outlineProblem(blocks) === null && problem === null;
  const hasCode = blocks.some((b) => b.kind === 'class-code');
  const codeBlock = roster ? classCodeBlock(roster.joinCode) : null;
  const namesMode = picker === 'names' || picker === 'initials';
  const options: LectureOptionValues = { romanization, strokeGuide, sound, uiLocale: presenterLocale };

  const linkFor = (r: Roster) =>
    presenterLink(appUrl(), {
      title,
      blocks,
      options: { romanization, strokeGuide, sound, uiLocale: presenterLocale },
      picker: deckPicker(picker, r),
      source,
      now: new Date(),
      rng: Math.random,
    });

  const open = (): void => {
    if (!roster || !canPresent) return;
    const link = linkFor(roster);
    if (!link.ok) {
      setNotice('linkFailed');
      return;
    }
    pruneClosed(opened.current);
    const result = openPresenter(window, link.url);
    setNotice(result.ok ? null : 'blocked');
    if (result.ok) opened.current.set(result.win, { deckId: link.deck.id, roster: rosterMessage(link.deck.id, picker, roster) });
  };

  const copy = async (): Promise<void> => {
    if (!roster || !canPresent) return;
    if (hasCode && !window.confirm(l.copyHasCode)) return;
    const link = linkFor(roster);
    if (!link.ok) {
      setNotice('linkFailed');
      return;
    }
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setNotice(null);
    } catch {
      setCopied(false);
      setNotice('copyFailed');
    }
  };

  const edit = (next: LectureBlock[]): void => {
    setBlocks(next);
    setEdited(true);
  };
  const add = (block: LectureBlock): void => edit([...blocks, block]);

  const pickSource = (next: LectureSource): void => {
    if (edited && blocks.length > 0 && !window.confirm(l.replaceOutline)) return;
    choose(next, { plan, revisit });
  };

  const setOptions = (next: LectureOptionValues): void => {
    setRomanization(next.romanization);
    setStrokeGuide(next.strokeGuide);
    setSound(next.sound);
    setUiLocale(next.uiLocale);
  };

  return (
    <AdultFrame onSignOut={signOut} title={roster ? l.titleFor(roster.space.name) : l.title}>
      {back}
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {loading && !roster ? <Muted>{c.space.loading}</Muted> : null}
      {error ? (
        <div style={lectureSectionStyle}>
          <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}

      {roster && choices ? (
        <>
          <h1 style={{ fontSize: typography.size.title, margin: `0 0 ${spacing.xs}px` }}>{l.title}</h1>
          <Muted>{l.intro}</Muted>

          <LectureSourceSection source={source} plan={plan} revisit={revisit} plansFailed={plansFailed} omitted={omitted} onChoose={pickSource} onRetry={() => void load()} />
          {source === 'catalogue' ? <LectureCatalogueSection blocks={blocks} onChange={edit} /> : null}
          <LectureOutlineSection blocks={blocks} codeBlock={codeBlock} onChange={edit} onAdd={add} />
          <LectureOptionsSection value={options} available={available} onChange={setOptions} />
          <LecturePickerSection offered={choices.offered} value={picker} anonymized={roster.space.settings.anonymizeRoster} onChange={setPicker} />

          <section style={lectureSectionStyle} aria-label={l.titleField.label}>
            <Field
              name="title"
              label={l.titleField.label}
              value={title}
              onChange={(v) => {
                setTitle(v);
                setEdited(true);
              }}
              placeholder={l.titleField.placeholder}
              maxLength={TITLE_MAX}
              required
            />
            <Muted>{l.titleField.hint}</Muted>
            {title.trim().length > 0 && problem !== null ? (
              <p role="alert" style={{ color: colors.text.primary, backgroundColor: colors.feedback.nudgeLight, borderRadius: radii.md, padding: spacing.sm, margin: 0 }}>
                {l.titleProblem[problem]}
              </p>
            ) : null}
          </section>

          <section style={lectureSectionStyle} aria-label={l.check.title}>
            <h2 style={lectureH2Style}>{l.check.title}</h2>
            <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
              <li>{l.check.offline}</li>
              <li>{l.check.voice}</li>
              <li>{l.check.screen}</li>
              <li>{l.check.progress}</li>
              <li>{l.check.prepare}</li>
            </ul>
          </section>

          {notice === 'blocked' ? <Notice tone="nudge">{l.popupBlocked}</Notice> : null}
          {notice === 'copyFailed' ? <Notice tone="nudge">{l.copyFailed}</Notice> : null}
          {notice === 'linkFailed' ? <Notice tone="nudge">{l.linkFailed}</Notice> : null}
          {blocks.length === 0 ? <Muted>{l.nothing}</Muted> : null}
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button tone="primary" disabled={!canPresent} onClick={open} testId="open-presenter">
              {l.open.cta}
            </Button>
            <Button disabled={!canPresent} onClick={() => void copy()} testId="copy-presenter-link">
              {copied ? l.copied.cta : l.copyLink.cta}
            </Button>
          </div>
          {namesMode ? <Muted>{l.copyNoNames}</Muted> : null}
        </>
      ) : null}
    </AdultFrame>
  );
}

export default function LecturePage(): JSX.Element {
  return (
    <Suspense fallback={<AdultFrame>{null}</AdultFrame>}>
      <LectureInner />
    </Suspense>
  );
}
