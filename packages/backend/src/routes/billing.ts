import { RECEIPTS_PAGE_LIMIT } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor } from '../db';
import { fail, ok } from '../envelope';
import { accountActor, requireAccount, spaceContext } from '../lib/access';
import { billingSummaryFor, receiptUrl, receiptView, hasStripeReceipt } from '../lib/billing-summary';
import { can } from '../lib/can';
import { recordServerEvent } from '../lib/server-events';
import { requireStepUp } from '../lib/step-up';
import { billingLiveAllowed, stripeMode, type StripeEnv } from '../lib/stripe';
import type { Account } from '../store';
import type { Context } from 'hono';
import type { Db } from '../db';

/**
 * /api/billing — F-BILL-002 B-4 (section 5.3). The billing home's summary for
 * every grown-up persona, one space's receipts for its payer (OD-8: viewers
 * never get receipts), and a receipt link fetched fresh from Stripe behind
 * step-up and the live guard. Only the receipt link calls Stripe; nothing
 * here writes besides `requireAccount`'s first-sign-in upsert.
 */
type Env = { Bindings: StripeEnv };
export const billingRoutes = new Hono<Env>();

let receiptFetch: typeof fetch | null = null;
/** Test seam: the fetch used for the Stripe receipt lookups. */
export function setReceiptFetchForTests(f: typeof fetch | null): void {
  receiptFetch = f;
}

/** The opaque `bev:` id of a history row (`BillingEventSchema`), the only thing the page sends. */
function receiptIdOf(body: unknown): string | null {
  const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : null;
  return typeof id === 'string' && /^bev:[a-z0-9-]+$/.test(id) ? id : null;
}

/** Is the account a payer (`space.manage`) of the space? The caller has checked the space exists. */
async function paysFor(db: Db, account: Account, spaceId: string): Promise<'payer' | 'forbidden' | 'not_found'> {
  const space = await db.getSpace(spaceId);
  if (!space) return 'not_found';
  return can(await accountActor(db, account), 'space.manage', { kind: 'space', ctx: await spaceContext(db, space) }) ? 'payer' : 'forbidden';
}

function refusal(c: Context, verdict: 'forbidden' | 'not_found'): Response {
  return verdict === 'not_found' ? fail(c, 'not_found', 'Space not found', 404) : fail(c, 'forbidden', 'Only the person who pays for this space can see its receipts', 403);
}

billingRoutes.get('/summary', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const env = c.env ?? {};
  const summary = await billingSummaryFor(dbFor(c), env, account.id, new Date());
  // A checkout-return poll is not a visit (section 10).
  if (c.req.query('poll') !== '1') recordServerEvent('billing.summary_viewed', { cards: summary.cards.length, payerCards: summary.cards.filter((card) => card.payer).length, mode: summary.mode });
  return ok(c, summary);
});

billingRoutes.get('/receipts', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const spaceId = c.req.query('id');
  if (!spaceId) return fail(c, 'bad_request', 'Which space? Pass ?id=', 422);
  const db = dbFor(c);
  const verdict = await paysFor(db, account, spaceId);
  if (verdict !== 'payer') return refusal(c, verdict);
  const space = await db.getSpace(spaceId);
  const receipts = (await db.billingEventsFor('space', spaceId, RECEIPTS_PAGE_LIMIT)).map(receiptView);
  recordServerEvent('billing.receipts_viewed', { rows: receipts.length });
  return ok(c, { spaceName: space?.name ?? '', receipts });
});

billingRoutes.post('/receipt-link', async (c) => {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const receiptId = receiptIdOf(await c.req.json().catch(() => null));
  if (!receiptId) return fail(c, 'bad_request', 'Invalid receipt id', 422);
  const db = dbFor(c);
  const row = await db.billingEventById(receiptId);
  if (!row) return fail(c, 'not_found', 'Receipt not found', 404);
  if (row.subjectKind === 'account') {
    if (row.subjectId !== account.id) return fail(c, 'forbidden', 'Not your receipt', 403);
  } else {
    const verdict = await paysFor(db, account, row.subjectId);
    if (verdict !== 'payer') return refusal(c, verdict);
  }
  // The Stripe page shows the payer's name, email and address (section 4.10): a fresh sign-in first.
  const stepUp = await requireStepUp(c);
  if (stepUp) return stepUp;
  const env = c.env ?? {};
  const mode = stripeMode(env);
  if (mode === 'none') return fail(c, 'not_configured', 'Payments are not set up on this deployment', 503);
  if (mode === 'live' && !billingLiveAllowed(env)) return fail(c, 'live_not_enabled', 'Live payments are not open on this deployment', 503);
  if (!hasStripeReceipt(row)) return fail(c, 'no_receipt', 'Stripe has no receipt for this row', 404);
  const url = await receiptUrl(env, row, receiptFetch ?? globalThis.fetch);
  if (!url) return fail(c, 'receipt_unavailable', "Can't open this receipt right now", 502);
  return ok(c, { url });
});
