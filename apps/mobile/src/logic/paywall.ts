import type { Tier, TierSource } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { DeviceAudience } from './profiles/learner-type';
import type { OpenLinkOutcome } from './story/source-link';

/**
 * The learner Plan screen (F-BILL-002 B-9, sections 4.7 and 4.8; wireframe billing/plan-status;
 * mock design/screens/billing/plan-status.md). The navigation route key stays `Paywall`. The screen
 * shows status only: no PIN, no price, no offer, and on native builds no link and no word about
 * the web. Everything it shows comes from `planView`, so a test that scans `planTexts` covers
 * every word it can render.
 */
export type PaywallState = 'covered' | 'premium' | 'free';

/** Three calm states from the tier and its source (F-ENT-001 §3.5, unchanged). */
export function paywallState(tier: Tier, source: TierSource | null): PaywallState {
  if (tier !== 'premium') return 'free';
  return source && source.kind !== 'family' ? 'covered' : 'premium';
}

export interface PlanView {
  state: PaywallState;
  /** Hoya's pose: idle on the free plan, cheering on the full route. Decoration only. */
  pose: 'idle' | 'cheering';
  /** The screen heading, "Plan". */
  heading: string;
  /** `a11y.planStatus`: the heading's accessible label, the screen's first accessible element (section 8). */
  summary: string;
  /** The state sentence, worded for the device's audience. */
  title: string;
  /** The lines under the title (none on the free plan: the free slot speaks there). */
  lines: readonly string[];
  /** The free slot's default line (`caregiver.plan.free.open`) on the free plan; F-ENT-003 E3-8 replaces it while its switch is on. */
  freeSlotLine: string | null;
  /** Whether the guidance slot follows the full-route lines (empty until F-ENT-003 E3-8). */
  guidanceSlot: boolean;
  /** Web only: the caption, the Open billing button and its hint. Null on native builds (section 4.8). */
  billing: { caption: string; cta: string; hint: string } | null;
  back: string;
}

export interface PlanViewInput {
  tier: Tier;
  source: TierSource | null;
  audience: DeviceAudience;
  /** The active profile's name; blank or missing reads "Your learner". */
  name: string | null;
  /** `Platform.OS`. Only `web` gets the billing block. */
  platform: string;
}

const named = (value: string | null | undefined): string | null => (value === null || value === undefined || value.trim() === '' ? null : value);

export function planView(input: PlanViewInput, messages: Pick<Messages, 'caregiver' | 'learner' | 'a11y'>): PlanView {
  const m = messages.caregiver.plan;
  const card = messages.learner.profile.plan;
  const state = paywallState(input.tier, input.source);
  const name = named(input.name) ?? m.learnerFallback;
  const family = input.audience === 'family';
  let title: string;
  let lines: string[] = [];
  if (state === 'covered') {
    const space = named(input.source?.name) ?? m.covered.sourceFallback;
    title = family ? m.covered.title.family(name, space) : m.covered.title.self(space);
    lines = [family ? m.covered.note.family : m.covered.note.self];
  } else if (state === 'premium') {
    title = family ? m.full.title.family(name) : m.full.title.self;
    lines = [input.source?.kind === 'family' ? (family ? m.full.fromFamily.family : m.full.fromFamily.self) : m.full.noSource];
  } else {
    title = family ? m.free.title.family(name) : m.free.title.self;
  }
  return {
    state,
    pose: state === 'free' ? 'idle' : 'cheering',
    heading: m.title,
    summary: messages.a11y.planStatus(name, state === 'free' ? card.free : card.fullRoute),
    title,
    lines,
    freeSlotLine: state === 'free' ? m.free.open : null,
    guidanceSlot: state === 'premium',
    billing:
      input.platform === 'web'
        ? { caption: family ? m.openBilling.caption.family : m.openBilling.caption.self, cta: m.openBilling.cta, hint: m.openBilling.a11yHint }
        : null,
    back: m.backToJourney.cta,
  };
}

/** Every string a view carries, in screen order: what a deny-list or banned-word scan reads. */
export function planTexts(view: PlanView): string[] {
  return [
    view.heading,
    view.summary,
    view.title,
    ...view.lines,
    ...(view.freeSlotLine === null ? [] : [view.freeSlotLine]),
    ...(view.billing === null ? [] : [view.billing.caption, view.billing.cta, view.billing.hint]),
    view.back,
  ];
}

/** Open billing: inside the same tap when the gate opens directly (F-LEARN-001 L7), else through `PinEntry { next: 'Billing' }`. */
export function billingPressStep(gateOpensDirectly: boolean): 'open' | 'gate' {
  return gateOpensDirectly ? 'open' : 'gate';
}

/**
 * Back on the Plan screen after the gate: a press waiting on it opens billing once the gate is
 * through and is dropped when the gate was cancelled; a return with nothing waiting does nothing.
 */
export function pendingBillingStep(pending: boolean, gateOpensDirectly: boolean): 'none' | 'open' | 'drop' {
  if (!pending) return 'none';
  return gateOpensDirectly ? 'open' : 'drop';
}

/** The line under Open billing: nothing once billing opened, else the address to type (section 4.7). */
export function billingNote(outcome: OpenLinkOutcome, url: string, messages: Pick<Messages, 'caregiver'>): string | null {
  return outcome === 'opened' ? null : messages.caregiver.plan.openFailed(url);
}

export interface PlanCardView {
  title: string;
  note: string;
  pill: string;
  /** The pill and card tone: success on the full route, neutral (sunken card) on the free plan. */
  tone: 'success' | 'neutral';
  cta: string;
}

/** The Profile plan card (section 4.7, 6.3): Free plan or Full route, and Plan details on every tier. */
export function planCardView(tier: Tier, source: TierSource | null, m: Messages['learner']['profile']['plan']): PlanCardView {
  const full = tier === 'premium';
  return {
    title: full ? m.fullRoute : m.free,
    note: full ? m.open(named(source?.name)) : m.freeNote,
    pill: full ? m.pillActive : m.pillFree,
    tone: full ? 'success' : 'neutral',
    cta: m.details.cta,
  };
}

const DEFAULT_CONSOLE = 'https://hangulroute.com';

/** Where a grown-up manages billing on the web today (F-BILL-002 B-9b moves it to the app host behind the flag). */
// Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads, so the default spells the key out.
export function consoleBillingUrl(env: { EXPO_PUBLIC_CONSOLE_URL?: string } = { EXPO_PUBLIC_CONSOLE_URL: process.env.EXPO_PUBLIC_CONSOLE_URL }): string {
  const base = (env.EXPO_PUBLIC_CONSOLE_URL?.trim() || DEFAULT_CONSOLE).replace(/\/$/, '');
  return `${base}/teach/billing`;
}
