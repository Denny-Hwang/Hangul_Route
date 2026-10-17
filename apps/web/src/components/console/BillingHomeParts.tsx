'use client';

import { IconSvg } from '@hangul-route/design-system/icon-glyphs/dom';
import { borderWidth, colors, layout, radii, spacing, touchTarget, typography, z } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import type { BillingAccountCardView, BillingCardView, BillingHomeView, BillingOfferView, ContactRowView, ReceiptRowView } from '@/lib/console/billing-summary';
import { useMessages } from '@/lib/i18n/locale-context';
import { headRem } from '@/lib/console/rem';

/**
 * The billing home's parts (F-BILL-002 B-8a; screen spec `design/screens/billing/billing-home.md`, mocks
 * `billing-home.html`, `billing-home-teacher.html`, `billing-home-states.html`): drawn from B-7's view model
 * (`billing-summary.ts`), which holds every word, price and date. The page decides what is enabled.
 *
 * Neutral tones only: no danger colour, no urgency; prices only inside an offer and in a payer's receipts. Glyphs are
 * decoration (`aria-hidden`); every state is in words. Every control is at least `touchTarget.min` tall.
 */

/** The browser's default text size: type is written in rem from the px tokens, so the browser text size enlarges it. */
const ROOT_FONT_PX = 16;
const rem = (px: number): string => `${px / ROOT_FONT_PX}rem`;
const px = (value: number): string => `${value}px`;

/** Layout constants of the design pass (`design/screens/billing/README.md`, Constants), in em / rem so text size moves them. */
const WIDE = '45em'; // the adult frame's phone / wide switch (F-APP-001 section 3.8)
const PLAN_CARD_MIN = '22rem';
const DIALOG_MAX = '28rem';
const RECEIPTS_TABLE_MIN = '36rem';
const RECEIPT_AMOUNT_MIN = '6rem';
const FIELD_BASIS = '10rem';
const GLYPH = 20;

const focusRing = `outline:${px(borderWidth.thick)} solid ${colors.border.focus};outline-offset:${px(borderWidth.base)}`;

export const BILLING_CSS = `
.hr-bill{display:flex;flex-direction:column;gap:${rem(spacing.lg)};color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal};overflow-wrap:anywhere;container:bill / inline-size}
.hr-bill p,.hr-bill h1,.hr-bill h2,.hr-bill h3,.hr-bill h4,.hr-bill ul,.hr-bill form{margin:0;padding:0}
.hr-bill ul{list-style:none}
.hr-bill-reading{max-width:${px(layout.maxWidth.reading)}}
.hr-bill h1{font-size:${headRem(typography.size.title)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-hidden{position:absolute;width:${px(borderWidth.thin)};height:${px(borderWidth.thin)};margin:-${px(borderWidth.thin)};padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.hr-bill-section{display:flex;flex-direction:column;gap:${rem(spacing.md)}}
.hr-bill-section>h2{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-banner{align-self:flex-start;padding:${rem(spacing.sm)} ${rem(spacing.md)};border-radius:${px(radii.md)};background:${colors.surface.sunken};color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-bill-notice{display:flex;flex-direction:column;gap:${rem(spacing.sm)};padding:${rem(spacing.lg)};border-radius:${px(radii.lg)};background:${colors.feedback.infoLight}}
.hr-bill-notice-success{background:${colors.feedback.successLight}}
.hr-bill-notice-line{display:flex;gap:${rem(spacing.sm)};align-items:flex-start}
.hr-bill-notice-line svg{flex:none;margin-top:${rem(spacing.xxs)}}
.hr-bill-panel{display:flex;flex-direction:column;align-items:flex-start;gap:${rem(spacing.md)};padding:${rem(spacing.lg)};border-radius:${px(radii.lg)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-bill-btn{display:inline-flex;align-items:center;justify-content:center;gap:${rem(spacing.sm)};min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.xl)};border-radius:${px(radii.pill)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight};text-align:center;text-decoration:none;cursor:pointer;align-self:flex-start;box-sizing:border-box}
.hr-bill-btn-primary{background:${colors.brand.primary};border-color:${colors.brand.primary};color:${colors.text.onPrimary}}
.hr-bill-btn-block{width:100%;align-self:stretch}
.hr-bill-btn:disabled{background:${colors.surface.sunken};border-color:${colors.surface.sunken};color:${colors.text.muted};cursor:default}
.hr-bill-btn:focus-visible,.hr-bill-disclosure>summary:focus-visible,.hr-bill-link:focus-visible,.hr-bill-card h3:focus-visible,.hr-bill-input:focus-visible{${focusRing}}
.hr-bill-link{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};color:${colors.brand.secondaryDark};font-weight:${typography.weight.semibold};text-decoration:underline;text-underline-offset:${rem(spacing.xs)}}
.hr-bill-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,${PLAN_CARD_MIN}),1fr));gap:${rem(spacing.lg)};align-items:start}
.hr-bill-card{display:flex;flex-direction:column;gap:${rem(spacing.xs)};padding:${rem(spacing.lg)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.lg)};min-width:0}
.hr-bill-card-marked{border:${px(borderWidth.thick)} solid ${colors.brand.secondary};padding:calc(${rem(spacing.lg)} - ${px(borderWidth.thick - borderWidth.thin)})}
.hr-bill-card h3{font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-plan{font-weight:${typography.weight.semibold}}
.hr-bill-line{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-bill-rule{padding-top:${rem(spacing.sm)};margin-top:${rem(spacing.xs)};border-top:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-bill-actions{display:flex;flex-wrap:wrap;gap:${rem(spacing.sm)};margin-top:${rem(spacing.sm)}}
.hr-bill-next{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-bill-next>p{font-weight:${typography.weight.semibold}}
.hr-bill-offer{display:flex;flex-direction:column;gap:${rem(spacing.sm)}}
.hr-bill-card .hr-bill-offer{margin-top:${rem(spacing.sm)};padding-top:${rem(spacing.md)};border-top:${px(borderWidth.thin)} solid ${colors.border.subtle}}
.hr-bill-offer h3,.hr-bill-offer h4{font-size:${rem(typography.size.body)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-add-row{padding:${rem(spacing.lg)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.lg)};min-width:0}
.hr-bill-includes{display:flex;flex-direction:column;gap:${rem(spacing.xs)}}
.hr-bill-includes li{display:flex;gap:${rem(spacing.sm)};align-items:flex-start;font-size:${rem(typography.size.bodySm)}}
.hr-bill-includes svg{flex:none;margin-top:${rem(spacing.xxs)}}
.hr-bill-price{font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-price-promo{font-size:${rem(typography.size.body)}}
.hr-bill-disclosure>summary{display:inline-flex;align-items:center;gap:${rem(spacing.xs)};min-height:${px(touchTarget.min)};color:${colors.brand.secondaryDark};font-weight:${typography.weight.semibold};cursor:pointer;list-style:none}
.hr-bill-disclosure>summary::-webkit-details-marker{display:none}
.hr-bill-disclosure[open]>summary svg{transform:rotate(90deg)}
.hr-bill-disclosure-body{display:flex;flex-direction:column;gap:${rem(spacing.sm)};padding-bottom:${rem(spacing.xs)}}
.hr-bill-promo{display:flex;flex-wrap:wrap;align-items:flex-end;gap:${rem(spacing.sm)}}
.hr-bill-field{display:flex;flex-direction:column;gap:${rem(spacing.xxs)};flex:1 1 ${FIELD_BASIS};min-width:0}
.hr-bill-field-label{font-size:${rem(typography.size.caption)};color:${colors.text.muted}}
.hr-bill-input{min-height:${px(touchTarget.min)};padding:${rem(spacing.sm)} ${rem(spacing.md)};border-radius:${px(radii.md)};border:${px(borderWidth.thin)} solid ${colors.border.strong};background:${colors.surface.paper};color:${colors.text.primary};font:inherit;font-size:${rem(typography.size.body)};width:100%;box-sizing:border-box}
.hr-bill-mini{display:flex;flex-direction:column}
.hr-bill-mini li{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:${rem(spacing.sm)};row-gap:${rem(spacing.xxs)};padding:${rem(spacing.xs)} 0;border-top:${px(borderWidth.thin)} solid ${colors.border.subtle};font-size:${rem(typography.size.bodySm)}}
.hr-bill-mini li:first-child{border-top:none}
.hr-bill-mini .hr-bill-date{color:${colors.text.secondary}}
.hr-bill-mini .hr-bill-amount{margin-left:auto;font-weight:${typography.weight.semibold}}
.hr-bill-pill{display:inline-flex;align-items:center;padding:0 ${rem(spacing.sm)};border-radius:${px(radii.pill)};background:${colors.surface.sunken};color:${colors.text.secondary};font-size:${rem(typography.size.caption)};font-weight:${typography.weight.semibold}}
.hr-bill-help p{color:${colors.text.secondary}}
.hr-bill-skeleton-card{height:calc(2 * ${rem(spacing.jumbo)});border-radius:${px(radii.lg)};background:${colors.surface.sunken}}
.hr-bill-skeleton-line{height:${rem(spacing.xl)};width:50%;border-radius:${px(radii.sm)};background:${colors.surface.sunken}}
.hr-bill-table{width:100%;border-collapse:separate;border-spacing:0 ${rem(spacing.sm)}}
.hr-bill-table caption{text-align:left;font-size:${rem(typography.size.bodyLg)};font-weight:${typography.weight.bold};padding-bottom:${rem(spacing.xs)}}
.hr-bill-table thead{position:absolute;width:${px(borderWidth.thin)};height:${px(borderWidth.thin)};overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.hr-bill-table tbody,.hr-bill-table tr,.hr-bill-table th,.hr-bill-table td{display:block}
.hr-bill-table tbody tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:${rem(spacing.md)};row-gap:${rem(spacing.xxs)};padding:${rem(spacing.md)} ${rem(spacing.lg)};margin-bottom:${rem(spacing.sm)};background:${colors.surface.paper};border:${px(borderWidth.thin)} solid ${colors.border.subtle};border-radius:${px(radii.lg)}}
.hr-bill-table th[scope="row"]{font-weight:${typography.weight.regular};color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)};text-align:left}
.hr-bill-table .hr-bill-c-what{font-weight:${typography.weight.semibold};display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:${rem(spacing.xs)};text-align:right}
.hr-bill-table .hr-bill-c-amount{text-align:right;font-weight:${typography.weight.semibold};white-space:nowrap}
.hr-bill-table .hr-bill-c-action{grid-column:1/-1;display:flex;flex-direction:column;gap:${rem(spacing.xxs)}}
.hr-bill-table .hr-bill-c-action:empty{display:none}
@container bill (min-width:${RECEIPTS_TABLE_MIN}){
.hr-bill-table{border-spacing:0}
.hr-bill-table thead{position:static;width:auto;height:auto;overflow:visible;clip-path:none;white-space:normal;display:table-header-group}
.hr-bill-table tbody{display:table-row-group}
.hr-bill-table tr,.hr-bill-table tbody tr{display:table-row;padding:0;margin:0;background:none;border:none;border-radius:0}
.hr-bill-table th,.hr-bill-table td{display:table-cell;padding:${rem(spacing.sm)} ${rem(spacing.md)};border-bottom:${px(borderWidth.thin)} solid ${colors.border.subtle};vertical-align:middle;text-align:left}
.hr-bill-table thead th,.hr-bill-table thead td{font-size:${rem(typography.size.caption)};color:${colors.text.muted};font-weight:${typography.weight.semibold}}
.hr-bill-table tbody tr{background:${colors.surface.paper}}
.hr-bill-table .hr-bill-c-what{display:table-cell;text-align:left}
.hr-bill-table .hr-bill-c-what .hr-bill-pill{margin-left:${rem(spacing.xs)}}
.hr-bill-table .hr-bill-c-amount{text-align:right;min-width:${RECEIPT_AMOUNT_MIN}}
.hr-bill-table th[scope="row"]{white-space:nowrap}
.hr-bill-table .hr-bill-c-action:empty{display:table-cell}
}
.hr-bill-scrim{position:fixed;inset:0;background:${colors.surface.overlay};z-index:${z.modal};display:flex;align-items:center;justify-content:center;padding:${rem(spacing.lg)} ${px(layout.gutter.compact)};overflow-y:auto}
.hr-bill-dialog{width:100%;max-width:${DIALOG_MAX};display:flex;flex-direction:column;gap:${rem(spacing.md)};padding:${rem(spacing.xl)};background:${colors.surface.paper};border-radius:${px(radii.lg)};color:${colors.text.primary};font-size:${rem(typography.size.body)};line-height:${typography.leading.normal};overflow-wrap:anywhere}
.hr-bill-dialog h2{margin:0;font-size:${rem(typography.size.prompt)};font-weight:${typography.weight.bold};line-height:${typography.leading.tight}}
.hr-bill-dialog p{margin:0}
.hr-bill-dialog .hr-bill-reason{color:${colors.text.secondary};font-size:${rem(typography.size.bodySm)}}
.hr-bill-dialog-actions{display:flex;flex-direction:column;gap:${rem(spacing.sm)};margin-top:${rem(spacing.sm)}}
@media (min-width:${WIDE}){
.hr-bill-offer .hr-bill-btn-block{width:auto;align-self:flex-start}
}
`;

export function BillingStyles(): JSX.Element {
  return <style>{BILLING_CSS}</style>;
}

export function ModeBanner({ text }: { text: string | null }): JSX.Element | null {
  return text ? <p className="hr-bill-banner">{text}</p> : null;
}

/** One neutral page note (console `Notice` look, info tone, its own polite region). */
export function BillingNote({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="hr-bill-notice" role="status">
      <p>{children}</p>
    </div>
  );
}

/** The panel when the summary could not be read: offline or an error, and Try again. No cards under it. */
export function FailPanel({ text, retry, onRetry, disabled }: { text: string; retry: string; onRetry: () => void; disabled?: boolean }): JSX.Element {
  return (
    <div className="hr-bill-panel" data-testid="bill-fail">
      <p>{text}</p>
      <button type="button" className="hr-bill-btn" onClick={onRetry} disabled={disabled}>
        {retry}
      </button>
    </div>
  );
}

/** Loading: a grey line where the banner goes and three grey card outlines; no numbers, nothing moves. */
export function BillingSkeleton(): JSX.Element {
  return (
    <div className="hr-bill-section" aria-busy="true" data-testid="bill-loading">
      <div className="hr-bill-skeleton-line" />
      <div className="hr-bill-cards">
        <div className="hr-bill-skeleton-card" />
        <div className="hr-bill-skeleton-card" />
        <div className="hr-bill-skeleton-card" />
      </div>
    </div>
  );
}

function Includes({ lines }: { lines: string[] }): JSX.Element {
  return (
    <ul className="hr-bill-includes">
      {lines.map((line) => (
        <li key={line}>
          <IconSvg name="check" size={GLYPH} color={colors.feedback.success} />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Disclosure({ summary, children }: { summary: string; children: ReactNode }): JSX.Element {
  return (
    <details className="hr-bill-disclosure">
      <summary>
        <IconSvg name="arrow-right" size={GLYPH} color={colors.brand.secondaryDark} />
        <span>{summary}</span>
      </summary>
      <div className="hr-bill-disclosure-body">{children}</div>
    </details>
  );
}

/** The F-ENT-002 promo form inside **Have a code?** (design D4): field, Apply code / Change code, the result line. */
export interface PromoFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  applied: boolean;
  /** The result line (`promo.applied` …) or the hint. */
  note: string;
  disabled: boolean;
}

function PromoForm({ value, onChange, onSubmit, applied, note, disabled }: PromoFormProps): JSX.Element {
  const c = useMessages().console;
  const id = useId();
  return (
    <Disclosure summary={c.billing.promo.disclosure}>
      <form
        className="hr-bill-promo"
        aria-label={c.billing.promo.formLabel}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="hr-bill-field" htmlFor={id}>
          <span className="hr-bill-field-label">{c.promoLabel}</span>
          <input className="hr-bill-input" id={id} name="promo" value={value} maxLength={32} placeholder={c.billing.promo.placeholder} onChange={(e) => onChange(e.target.value)} />
        </label>
        <button type="submit" className="hr-bill-btn" disabled={disabled}>
          {applied ? c.billing.promo.change.cta : c.billing.promo.apply.cta}
        </button>
      </form>
      <p className="hr-bill-line" role="status">
        {note}
      </p>
    </Disclosure>
  );
}

/** An offer: inside the one buyable card (h4), or a row of Add a plan (h3). Prices appear only here. */
export function OfferBlock({ offer, level, promo, onBuy, disabled }: { offer: BillingOfferView; level: 'h3' | 'h4'; promo: PromoFormProps | null; onBuy: () => void; disabled: boolean }): JSX.Element {
  const id = useId();
  const Heading = level;
  return (
    <div className="hr-bill-offer" role="group" aria-labelledby={id} data-testid="bill-offer">
      <Heading id={id}>{offer.title}</Heading>
      <Includes lines={offer.includes} />
      <p className={promo?.applied ? 'hr-bill-price hr-bill-price-promo' : 'hr-bill-price'}>{offer.price}</p>
      <p className="hr-bill-line">{offer.renew}</p>
      {promo ? <PromoForm {...promo} /> : null}
      <button type="button" className={offer.primary ? 'hr-bill-btn hr-bill-btn-primary hr-bill-btn-block' : 'hr-bill-btn hr-bill-btn-block'} onClick={onBuy} disabled={disabled}>
        {offer.cta}
      </button>
    </div>
  );
}

function MiniReceipts({ rows }: { rows: ReceiptRowView[] }): JSX.Element {
  return (
    <ul className="hr-bill-mini">
      {rows.map((row) => (
        <li key={row.id}>
          <span className="hr-bill-date">{row.date}</span>
          <span>{row.kind}</span>
          {row.testPill ? <span className="hr-bill-pill">{row.testPill}</span> : null}
          <span className="hr-bill-amount">{row.amount}</span>
        </li>
      ))}
    </ul>
  );
}

export interface CardHandlers {
  onManage: () => void;
  /** Buy, Manage and Apply code reach Stripe; Connect a learner, Receipts, All receipts and Contact us stay enabled (D5). */
  actionsDisabled: boolean;
  offer: { promo: PromoFormProps | null; onBuy: () => void } | null;
  contactHref: string;
  /** The card a checkout return waits on (B-8b, D8). */
  marked?: boolean;
  busy?: boolean;
  headingRef?: (el: HTMLHeadingElement | null) => void;
}

export function BillingCard({ card, handlers }: { card: BillingCardView; handlers: CardHandlers }): JSX.Element {
  const b = useMessages().console.billing;
  const id = useId();
  return (
    <section className={handlers.marked ? 'hr-bill-card hr-bill-card-marked' : 'hr-bill-card'} aria-labelledby={id} aria-busy={handlers.busy ? true : undefined} data-testid="bill-card">
      <h3 id={id} tabIndex={-1} ref={handlers.headingRef}>
        {card.heading}
      </h3>
      <p className="hr-bill-plan">{card.plan}</p>
      {card.status ? <p className="hr-bill-line">{card.status}</p> : null}
      {card.usage ? <p className="hr-bill-line">{card.usage}</p> : null}
      {card.readOnly ? <p className="hr-bill-line hr-bill-rule">{card.readOnly}</p> : null}
      {card.offer && handlers.offer ? <OfferBlock offer={card.offer} level="h4" promo={handlers.offer.promo} onBuy={handlers.offer.onBuy} disabled={handlers.actionsDisabled} /> : null}
      {card.connectLearner ? (
        <div className="hr-bill-next hr-bill-rule">
          <p>{card.connectLearner.line}</p>
          <Link className="hr-bill-btn" href={card.connectLearner.href}>
            {card.connectLearner.cta}
          </Link>
        </div>
      ) : null}
      {card.manage || card.contact ? (
        <div className="hr-bill-actions">
          {card.manage ? (
            <button type="button" className="hr-bill-btn" onClick={handlers.onManage} disabled={handlers.actionsDisabled}>
              {b.manage.cta}
            </button>
          ) : null}
          {card.contact ? (
            <a className="hr-bill-btn" href={handlers.contactHref}>
              {b.contact.cta}
            </a>
          ) : null}
        </div>
      ) : null}
      {card.receipts.length > 0 ? (
        <Disclosure summary={b.receipts.title}>
          <MiniReceipts rows={card.receipts} />
        </Disclosure>
      ) : null}
      {card.allReceiptsHref ? (
        <Link className="hr-bill-btn" href={card.allReceiptsHref}>
          {b.receipts.all.cta}
        </Link>
      ) : null}
      {card.legacyNoHistory ? <p className="hr-bill-line">{b.receipts.older}</p> : null}
    </section>
  );
}

/** A legacy account-subject card (always the viewer's own): plan, status, Manage, inline receipts only. */
export function AccountCard({ card, onManage, actionsDisabled }: { card: BillingAccountCardView; onManage: () => void; actionsDisabled: boolean }): JSX.Element {
  const b = useMessages().console.billing;
  const id = useId();
  return (
    <section className="hr-bill-card" aria-labelledby={id} data-testid="bill-account-card">
      <h3 id={id}>{card.heading}</h3>
      <p className="hr-bill-plan">{card.plan}</p>
      {card.status ? <p className="hr-bill-line">{card.status}</p> : null}
      {card.manage ? (
        <div className="hr-bill-actions">
          <button type="button" className="hr-bill-btn" onClick={onManage} disabled={actionsDisabled}>
            {b.manage.cta}
          </button>
        </div>
      ) : null}
      {card.receipts.length > 0 ? (
        <Disclosure summary={b.receipts.title}>
          <MiniReceipts rows={card.receipts} />
        </Disclosure>
      ) : null}
      {card.legacyNoHistory ? <p className="hr-bill-line">{b.receipts.older}</p> : null}
    </section>
  );
}

export function AddPlanSection({
  offers,
  contact,
  promo,
  onBuy,
  disabled,
  waitingSpaceId = null,
}: {
  offers: BillingOfferView[];
  contact: ContactRowView[];
  promo: PromoFormProps | null;
  onBuy: (offer: BillingOfferView) => void;
  disabled: boolean;
  /** The space a checkout return waits on (B-8b): its row's button stays off. */
  waitingSpaceId?: string | null;
}): JSX.Element {
  const b = useMessages().console.billing;
  const id = useId();
  return (
    <section className="hr-bill-section" aria-labelledby={id}>
      <h2 id={id}>{b.sections.add}</h2>
      <div className="hr-bill-cards">
        {offers.map((offer, i) => (
          <div className="hr-bill-add-row" key={`${offer.spaceId}-${offer.planKey}`}>
            <OfferBlock offer={offer} level="h3" promo={i === 0 ? promo : null} onBuy={() => onBuy(offer)} disabled={disabled || offer.spaceId === waitingSpaceId} />
          </div>
        ))}
        {contact.map((row) => (
          <div className="hr-bill-add-row hr-bill-offer" key={`contact-${row.spaceId}`}>
            <h3>{row.title}</h3>
            <a className="hr-bill-btn" href={row.href}>
              {row.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HelpSection({ help }: { help: BillingHomeView['help'] }): JSX.Element {
  const b = useMessages().console.billing;
  const id = useId();
  return (
    <section className="hr-bill-section hr-bill-help" aria-labelledby={id}>
      <h2 id={id}>{b.sections.help}</h2>
      <p>{help.refund}</p>
      <p>{help.learners}</p>
      <p>{help.sharedDevice}</p>
    </section>
  );
}

export function EmptyState({ empty }: { empty: NonNullable<BillingHomeView['empty']> }): JSX.Element {
  const id = useId();
  return (
    <section className="hr-bill-section" aria-labelledby={id}>
      <h2 id={id}>{empty.title}</h2>
      <div className="hr-bill-actions">
        <Link className="hr-bill-btn hr-bill-btn-primary" href={empty.family.href}>
          {empty.family.cta}
        </Link>
        <Link className="hr-bill-btn" href={empty.class.href}>
          {empty.class.cta}
        </Link>
      </div>
    </section>
  );
}

/**
 * The checkout return's one polite live region (B-8b; `design/screens/billing/checkout-return.md`): mounted for the
 * whole page so each state change is announced once. The words and the button come from `returnNotice`.
 */
export function ReturnNoticeRegion({ notice, done, checking, onAction }: { notice: { text: string; action: { label: string } | null } | null; done: boolean; checking: boolean; onAction: () => void }): JSX.Element {
  return (
    <div role="status" aria-live="polite" data-testid="bill-return">
      {notice ? (
        <div className={done ? 'hr-bill-notice hr-bill-notice-success' : 'hr-bill-notice'}>
          <p className="hr-bill-notice-line">
            {done ? <IconSvg name="check-circle" size={GLYPH} color={colors.feedback.successDark} /> : checking ? <IconSvg name="replay" size={GLYPH} color={colors.text.secondary} /> : null}
            <span>{notice.text}</span>
          </p>
          {notice.action ? (
            <button type="button" className="hr-bill-btn" onClick={onAction}>
              {notice.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Back to Billing (the receipts page): the back-link look with the `arrow-left` glyph. */
export function BackToBilling({ href }: { href: string }): JSX.Element {
  const b = useMessages().console.billing;
  return (
    <Link className="hr-bill-link" href={href}>
      <IconSvg name="arrow-left" size={GLYPH} color={colors.brand.secondaryDark} />
      <span>{b.receipts.back.cta}</span>
    </Link>
  );
}

/** Loading on the receipts page: three grey row outlines, nothing moves. */
export function ReceiptsSkeleton(): JSX.Element {
  return (
    <div className="hr-bill-section" aria-busy="true" data-testid="receipts-loading">
      <div className="hr-bill-skeleton-line" />
      <div className="hr-bill-skeleton-line" />
      <div className="hr-bill-skeleton-line" />
    </div>
  );
}

/**
 * The receipts table (B-8c; `design/screens/billing/receipts.md`, D10): one `table` with explicit ARIA roles, so the
 * narrow-column reflow (each row a block) keeps its semantics; the date is the row header; the action column's header
 * is hidden from assistive technology and each View receipt carries its own accessible name.
 */
/** A line under a row's View receipt: the lookup failed, or step-up is done and one more tap opens the receipt. */
export type ReceiptRowNote = 'failed' | 'tapAgain';

export function ReceiptsTable({ rows, notes, busyId, onView }: { rows: ReceiptRowView[]; notes: ReadonlyMap<string, ReceiptRowNote>; busyId: string | null; onView: (row: ReceiptRowView) => void }): JSX.Element {
  const r = useMessages().console.billing.receipts;
  return (
    <table className="hr-bill-table" role="table">
      <caption>{r.title}</caption>
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col">
            {r.column.date}
          </th>
          <th role="columnheader" scope="col">
            {r.column.what}
          </th>
          <th role="columnheader" scope="col">
            {r.column.plan}
          </th>
          <th role="columnheader" scope="col">
            {r.column.amount}
          </th>
          <td role="columnheader" aria-hidden="true" />
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr role="row" key={row.id}>
            <th role="rowheader" scope="row">
              {row.date}
            </th>
            <td role="cell" className="hr-bill-c-what">
              <span>{row.kind}</span>
              {row.testPill ? <span className="hr-bill-pill">{row.testPill}</span> : null}
            </td>
            <td role="cell" className="hr-bill-c-plan">
              {row.plan}
            </td>
            <td role="cell" className="hr-bill-c-amount">
              {row.amount}
            </td>
            <td role="cell" className="hr-bill-c-action">
              {row.hasReceipt ? (
                <>
                  <button type="button" className="hr-bill-btn" aria-label={row.viewA11y} onClick={() => onView(row)} disabled={busyId !== null}>
                    {row.viewLabel}
                  </button>
                  <p className="hr-bill-line" role="status">
                    {notes.get(row.id) === 'failed' ? r.linkFailed : notes.get(row.id) === 'tapAgain' ? r.tapAgain : ''}
                  </p>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
