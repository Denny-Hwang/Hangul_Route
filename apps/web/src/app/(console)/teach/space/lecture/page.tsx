'use client';

import { LECTURE_MAX_BLOCKS, type LectureBlock, type LecturePreset, type PresetContext, type PresetMinutes, type ResolvedPreset, type RomanizationMode, type StageKey, type UiLocale } from '@hangul-route/content-schema';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LectureChooserSection,
  LectureOptionsSection,
  LectureOutlineSection,
  LectureSourceSection,
  lectureH2Style,
  lectureSectionStyle,
  type LectureOptionValues,
} from '@/components/console/LectureParts';
import { LectureCustomize, LectureFooter, LecturePresetsLoading, LecturePresetsSection, PRESETS_CSS } from '@/components/console/LecturePresetParts';
import { Button, Field, Muted, Notice } from '@/components/console/ui';
import { AdultFrame } from '@/components/console/AdultFrame';
import { useConfirm } from '@/components/console/ConfirmSheet';
import { useConsole } from '@/components/console/use-console';
import type { PlanView, Roster } from '@/lib/console/api';
import { appUrl, lectureModeEnabled } from '@/lib/console/config';
import {
  aboutMinutes,
  classCodeBlock,
  lecturePlanFrom,
  lectureSourceFrom,
  outlineProblem,
  pickPlan,
  planOutline,
  presenterLink,
  revisitBlock,
  titleProblem,
  v2LinksAllowed,
  type LectureSource,
} from '@/lib/console/lecture';
import {
  consolePresetContext,
  consolePresetOrder,
  defaultPresetStage,
  needsV2,
  presetFallbackLine,
  presetFrom,
  presetMinutes,
  presetPlan,
  presetSource,
  presetStages,
  presetTitle,
  resolveConsolePreset,
} from '@/lib/console/lecture-presets';
import { openPresenter } from '@/lib/console/lecture-link';
import { dateKey } from '@/lib/console/plans';
import { classRollup } from '@/lib/console/rollup';
import { type SpaceError, spaceErrorText, spaceIdFrom } from '@/lib/console/routing';
import { spaceSubPageBack } from '@/lib/console/page-back';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { headRem } from '@/lib/console/rem';

const TITLE_MAX = 60;

/**
 * console/lecture-setup, presets first (AMENDMENTS-LECTURE-V2 sections 4.6, 6 and 18, row LV-4; F-TCH-004 §3.11;
 * wireframe `classroom/lecture-presets.md` Panel F; mock `design/screens/app-shell/lecture-setup.md`).
 *
 * The page opens on **Ready-made lessons**: one card open (the first in the section 4.1 order, or the one a
 * `?from=` names), its length and stage chips, and what it holds. **Customize** (closed) holds the Source, the
 * grouped chooser, the Outline prefilled from the preset, the Options with Slides language, the title and the
 * checks; a sticky footer holds the outline's minutes, **Open presenter** and **Copy link**. The outline is the one
 * lesson the link carries, whichever way it was made. No helper picker (LV-D7); family spaces read family words
 * (section 6); before `LECTURE_V2_LINKS_FROM` no Word review and no v2 link (section 4.5).
 */
function LectureInner(): JSX.Element {
  const params = useSearchParams();
  const spaceId = spaceIdFrom(params);
  const preselected = lectureSourceFrom(params);
  const planParam = lecturePlanFrom(params);
  const { ready, session, api, signOut, m, locale } = useConsole();
  const { available } = useConsoleLocale();
  const c = m.console;
  // The confirm step in the console language (AMENDMENTS-DISPLAY-NAV section 8).
  const { confirm, sheet: confirmSheet } = useConfirm();
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
  /** The typed title; null follows the chosen preset (its name in the console language, or the plan title it accepted). */
  const [title, setTitle] = useState<string | null>('');
  const [resolved, setResolved] = useState<ResolvedPreset | null>(null);
  const [open, setOpen] = useState<LecturePreset | null>(null);
  const [lengths, setLengths] = useState<Partial<Record<LecturePreset, PresetMinutes>>>({});
  const [stage, setStage] = useState<StageKey | null>(null);
  const [customize, setCustomize] = useState(false);
  /** Changes whenever the page replaces the outline, so the chooser opens again on its first lesson's tab and stage. */
  const [outlineKey, setOutlineKey] = useState(0);
  const [romanization, setRomanization] = useState<RomanizationMode>('always');
  const [strokeGuide, setStrokeGuide] = useState(true);
  const [sound, setSound] = useState(true);
  const [uiLocale, setUiLocale] = useState<UiLocale | null>(null);
  const [notice, setNotice] = useState<'blocked' | 'copyFailed' | 'linkFailed' | null>(null);
  const [copied, setCopied] = useState(false);
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  /** Whether the grown-up has changed what the page opened on (a card, a chip, a source, an edit, a title). */
  const touched = useRef(false);

  const rollup = roster ? classRollup(roster.learners, now) : null;
  const revisit = rollup ? revisitBlock(rollup.revisit) : null;
  const ctx = useMemo(() => consolePresetContext({ roster, plan: presetPlan(plan, planParam), today, now }), [roster, plan, planParam, today, now]);
  const stages = useMemo(() => presetStages(), []);
  const stageShown = stage ?? defaultPresetStage(ctx, stages);
  const order = useMemo(() => consolePresetOrder(ctx, now), [ctx, now]);
  // Each card's fallback line, open or closed (section 4.1): what it builds at its length now.
  const fallbacks = useMemo(
    () => new Map(order.map((preset) => [preset, presetFallbackLine(resolveConsolePreset(preset, presetMinutes(preset, lengths), stageShown, ctx).fallback, l.presets)] as const)),
    [order, lengths, stageShown, ctx, l.presets],
  );

  /** A preset's resolved blocks become the outline; the deck takes the preset's name until a title is typed. */
  const applyPreset = useCallback((preset: LecturePreset, minutes: PresetMinutes, chip: StageKey, context: PresetContext): void => {
    const res = resolveConsolePreset(preset, minutes, chip, context);
    setOpen(preset);
    setResolved(res);
    setBlocks(res.blocks);
    setOmitted(0);
    setSource(presetSource(res, context));
    setTitle(null);
    setEdited(false);
    setOutlineKey((k) => k + 1);
  }, []);

  const choose = useCallback((next: LectureSource, from: { plan: PlanView | null; revisit: LectureBlock | null }): void => {
    setSource(next);
    setEdited(false);
    setOmitted(0);
    // A source replaces the outline: it no longer comes from a preset card.
    setOpen(null);
    setResolved(null);
    setOutlineKey((k) => k + 1);
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

  /** What the page opens on (sections 4.1 and 4.6): the card `?from=` names, else the first card, with its outline. */
  const select = useCallback(
    (rosterData: Roster, chosen: PlanView | null): void => {
      const context = consolePresetContext({ roster: rosterData, plan: presetPlan(chosen, planParam), today, now });
      const chip = defaultPresetStage(context);
      setStage(chip);
      setLengths({});
      touched.current = false;
      const revisitNow = revisitBlock(classRollup(rosterData.learners, now).revisit);
      if (preselected === 'plan' && chosen && context.plan) {
        // "Present this plan": Next lesson open, the plan's own blocks as the outline (section 4.6).
        const outline = planOutline(chosen, today);
        applyPreset('next-lesson', presetMinutes('next-lesson', {}), chip, context);
        setBlocks(outline.blocks);
        setOmitted(outline.omitted);
        setSource('plan');
      } else if (preselected === 'revisit' && revisitNow) {
        // "Revisit together": the warm-up open, the space's letters to revisit as the outline.
        applyPreset('warm-up', presetMinutes('warm-up', {}), chip, context);
        setBlocks([revisitNow]);
        setSource('revisit');
      } else {
        const first = presetFrom(preselected) ?? consolePresetOrder(context, now)[0] ?? 'hangul-week-1';
        applyPreset(first, presetMinutes(first, {}), chip, context);
      }
    },
    [planParam, preselected, today, now, applyPreset],
  );

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
    setRoster(rosterRes.data);
    setPlan(chosen);
    setPlansFailed(!plansRes.ok);
    select(rosterRes.data, chosen);
  }, [api, enabled, spaceId, planParam, select]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Try again after the plans did not load: only the plans are read again. While the page is still what it opened on,
   * it opens again as a first load would (a plan to follow can now come first); once the grown-up has changed anything,
   * the outline, the title, the open card and the chips stay, and only the cards' words and the Source follow the plan.
   */
  const retryPlans = useCallback(async (): Promise<void> => {
    if (!api || !roster) return;
    const res = await api.listPlans(spaceId);
    if (!res.ok) return;
    const chosen = pickPlan(res.data, planParam);
    setPlan(chosen);
    setPlansFailed(false);
    if (!touched.current) select(roster, chosen);
  }, [api, roster, spaceId, planParam, select]);

  const deckTitle = title ?? (resolved ? presetTitle(resolved, l.presets) : '');

  // "Link copied" describes the deck that was copied: any change to it clears the label.
  useEffect(() => {
    setCopied(false);
  }, [deckTitle, blocks, romanization, strokeGuide, sound, uiLocale]);

  if (!ready || !session) return <AdultFrame>{null}</AdultFrame>;

  // PageBack (AMENDMENTS-DISPLAY-NAV section 7.3): back to the space, on every state of the page.
  const back = spaceSubPageBack(spaceId, roster?.space.kind, l.back(roster?.space.name ?? null));
  const heading = <h1 style={{ fontSize: headRem(typography.size.title), margin: `0 0 ${spacing.xs}px` }}>{l.title}</h1>;

  if (!enabled) {
    return (
      <AdultFrame onSignOut={signOut} back={back} title={l.title}>
        {heading}
        <Notice>{l.comingSoon}</Notice>
      </AdultFrame>
    );
  }

  const family = roster?.space.kind === 'family';
  const problem = roster ? titleProblem(deckTitle, roster) : 'empty';
  // The rollout rule (section 4.5): no v2 link before LECTURE_V2_LINKS_FROM.
  const v2Held = needsV2(blocks) && !v2LinksAllowed(now);
  const canPresent = roster !== null && outlineProblem(blocks) === null && problem === null && !v2Held;
  const hasCode = blocks.some((b) => b.kind === 'class-code');
  const codeBlock = roster ? classCodeBlock(roster.joinCode) : null;
  // "Same as this device" (null, the default) puts no language in the deck (owner items 6 and 7).
  const options: LectureOptionValues = { romanization, strokeGuide, sound, uiLocale };

  const linkFor = () =>
    presenterLink(appUrl(), {
      title: deckTitle,
      blocks,
      options: { romanization, strokeGuide, sound, ...(uiLocale !== null ? { uiLocale } : {}) },
      source,
      now: new Date(),
      rng: Math.random,
      preset: resolved?.preset ?? null,
    });

  const present = (): void => {
    if (!roster || !canPresent) return;
    const link = linkFor();
    if (!link.ok) {
      setNotice('linkFailed');
      return;
    }
    // A plain new tab with its opener cut (F-TCH-004 §3.11 as amended): nothing is handed over after the link.
    const result = openPresenter(window, link.url);
    setNotice(result.ok ? null : 'blocked');
  };

  const copy = async (): Promise<void> => {
    if (!roster || !canPresent) return;
    if (hasCode && !(await confirm({ title: family ? l.copyHasFamilyCode : l.copyHasCode, confirmLabel: c.confirm.copyAnyway }))) return;
    const link = linkFor();
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
    touched.current = true;
    setBlocks(next);
    setEdited(true);
  };
  const add = (block: LectureBlock): void => edit([...blocks, block]);

  /** A changed outline is replaced only after the grown-up says so. */
  const mayReplace = async (): Promise<boolean> => !edited || blocks.length === 0 || confirm({ title: l.replaceOutline, confirmLabel: c.confirm.replace });

  const pickSource = async (next: LectureSource): Promise<void> => {
    if (!(await mayReplace())) return;
    touched.current = true;
    choose(next, { plan, revisit });
  };

  const togglePreset = async (preset: LecturePreset): Promise<void> => {
    // A second press on the open card closes it; the outline stays what it is.
    if (open === preset) {
      touched.current = true;
      setOpen(null);
      return;
    }
    if (!(await mayReplace())) return;
    touched.current = true;
    applyPreset(preset, presetMinutes(preset, lengths), stageShown, ctx);
  };

  const chooseLength = async (preset: LecturePreset, minutes: PresetMinutes): Promise<void> => {
    if (!(await mayReplace())) return;
    touched.current = true;
    setLengths((current) => ({ ...current, [preset]: minutes }));
    applyPreset(preset, minutes, stageShown, ctx);
  };

  const chooseStage = async (next: StageKey): Promise<void> => {
    if (!(await mayReplace())) return;
    touched.current = true;
    setStage(next);
    applyPreset('by-stage', presetMinutes('by-stage', lengths), next, ctx);
  };

  const setOptions = (next: LectureOptionValues): void => {
    setRomanization(next.romanization);
    setStrokeGuide(next.strokeGuide);
    setSound(next.sound);
    setUiLocale(next.uiLocale);
  };

  // Under the title field while Customize is open; in the footer's alert line while it is closed.
  const titleText = deckTitle.trim().length > 0 && problem !== null ? l.titleProblem[problem] : null;
  const titleAlert =
    titleText !== null ? (
      <p role="alert" style={{ color: colors.text.primary, backgroundColor: colors.feedback.nudgeLight, borderRadius: radii.md, padding: spacing.sm, margin: 0 }}>
        {titleText}
      </p>
    ) : null;

  return (
    <AdultFrame onSignOut={signOut} back={back} title={roster ? l.titleFor(roster.space.name) : l.title}>
      <style>{PRESETS_CSS}</style>
      {confirmSheet}
      {!api ? <Notice tone="nudge">{c.shell.noApi}</Notice> : null}
      {error ? (
        <div style={lectureSectionStyle}>
          <p style={{ margin: 0 }}>{spaceErrorText(error, locale)}</p>
          <Button onClick={() => void load()}>{c.tryAgain}</Button>
        </div>
      ) : null}
      {loading && !roster ? (
        <>
          {heading}
          <Muted>{l.intro}</Muted>
          <LecturePresetsLoading loadingLine={c.space.loading} />
        </>
      ) : null}

      {roster ? (
        <>
          {heading}
          <Muted>{l.intro}</Muted>
          {plansFailed ? (
            <Notice tone="nudge">
              <p style={{ margin: `0 0 ${spacing.sm}px` }}>{l.plansFailed}</p>
              <Button onClick={() => void retryPlans()}>{c.tryAgain}</Button>
            </Notice>
          ) : null}

          <LecturePresetsSection
            order={order}
            open={open}
            minutesOf={(preset) => presetMinutes(preset, lengths)}
            stage={stageShown}
            stages={stages}
            fallbackOf={(preset) => fallbacks.get(preset) ?? null}
            note={open === 'next-lesson' && source === 'plan' && omitted > 0 ? l.source.trimmed(omitted, LECTURE_MAX_BLOCKS) : null}
            planTitle={ctx.plan?.title ?? null}
            family={family}
            outline={blocks}
            onToggle={(preset) => void togglePreset(preset)}
            onMinutes={(preset, minutes) => void chooseLength(preset, minutes)}
            onStage={(next) => void chooseStage(next)}
          />

          <LectureCustomize open={customize} onToggle={() => setCustomize((v) => !v)}>
            <LectureSourceSection source={source} plan={plan} revisit={revisit} plansFailed={false} omitted={omitted} onChoose={pickSource} onRetry={() => void retryPlans()} />
            <LectureChooserSection blocks={blocks} onChange={edit} resetKey={outlineKey} />
            <LectureOutlineSection blocks={blocks} codeBlock={codeBlock} family={family} onChange={edit} onAdd={add} />
            <LectureOptionsSection value={options} available={available} onChange={setOptions} />

            <section style={lectureSectionStyle} aria-label={l.titleField.label}>
              <Field
                name="title"
                label={l.titleField.label}
                value={deckTitle}
                onChange={(v) => {
                  touched.current = true;
                  setTitle(v);
                  setEdited(true);
                }}
                placeholder={l.titleField.placeholder}
                maxLength={TITLE_MAX}
                required
              />
              <Muted>{l.titleField.hint}</Muted>
              {titleAlert}
            </section>

            <section style={lectureSectionStyle} aria-label={family ? l.check.titleFamily : l.check.title}>
              <h2 style={lectureH2Style}>{family ? l.check.titleFamily : l.check.title}</h2>
              <ul style={{ margin: 0, paddingLeft: spacing.lg, color: colors.text.secondary, lineHeight: typography.leading.relaxed }}>
                <li>{l.check.offline}</li>
                <li>{l.check.voice}</li>
                <li>{l.check.screen}</li>
                <li>{l.check.progress}</li>
                <li>{l.check.prepare}</li>
              </ul>
            </section>
          </LectureCustomize>

          {/* The sticky footer (section 18.3): the outline's minutes, Open presenter and Copy link, and the answer to a press beside them. */}
          <LectureFooter
            minutes={aboutMinutes(blocks)}
            status={notice === 'blocked' ? l.popupBlocked : notice === 'copyFailed' ? l.copyFailed : notice === 'linkFailed' ? l.linkFailed : blocks.length === 0 ? l.nothing : ''}
            alert={!customize && titleText !== null ? titleText : ''}
            canPresent={canPresent}
            copied={copied}
            onPresent={present}
            onCopy={() => void copy()}
          />
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
