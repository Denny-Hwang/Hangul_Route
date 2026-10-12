-- Hangul Route — D1 migration 0007 (additive): billing history.
-- F-BILL-002 section 5.1. One new table recorded from Stripe webhooks (B-3)
-- and read by the billing summary and receipts routes (B-4), plus an index on
-- entitlements for the webhook's lookup by Stripe subscription id.
-- Nothing existing is altered or rewritten. No card data, no buyer details and
-- no receipt link are stored: amounts, dates and Stripe ids only (a receipt
-- link is fetched fresh from Stripe on each request and never kept).
-- Apply this migration before deploying the Worker that writes the table
-- (server first). Nothing reads the table until B-4 deploys.
-- Retention: rows live as long as their space. A later spec that deletes a
-- space or an account deletes its billing_events rows with it.
-- Rollback: an older Worker never reads the table; leave it in place.
CREATE TABLE IF NOT EXISTS billing_events (
  id            TEXT PRIMARY KEY,   -- bev:xxxx
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('account', 'space')),
  subject_id    TEXT NOT NULL,
  plan_key      TEXT NOT NULL CHECK (plan_key IN ('family_lifetime', 'group_license', 'school_seat')),
  kind          TEXT NOT NULL CHECK (kind IN ('purchase', 'renewal', 'refund', 'failed')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency      TEXT NOT NULL,      -- ISO 4217, lower-case as Stripe sends it
  provider      TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'stripe', 'manual')),
  provider_ref  TEXT NOT NULL,      -- payment intent, checkout session or invoice id (refunds: charge:refund:cumulative cents)
  payment_ref   TEXT,               -- the payment intent behind an invoice (refund matching), NULL when unknown
  livemode      INTEGER NOT NULL DEFAULT 0,
  occurred_at   TEXT NOT NULL,      -- ISO, from the Stripe object
  created_at    TEXT NOT NULL,
  UNIQUE (provider, provider_ref, kind)
);
CREATE INDEX IF NOT EXISTS idx_billing_events_subject ON billing_events(subject_kind, subject_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_payment ON billing_events(payment_ref);
-- The webhook looks entitlements up by Stripe subscription id (entitlementByProviderRef).
CREATE INDEX IF NOT EXISTS idx_entitlements_provider_ref ON entitlements(provider, provider_ref);
