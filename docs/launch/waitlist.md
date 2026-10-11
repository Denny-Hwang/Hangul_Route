# Launch-invite waitlist (runbook)

The "Send me the invite" form on hangulroute.com (`#get`) saves an email address in our own database. No third-party newsletter service is involved, and **nothing is sent from it yet**: the list is only collected.

## How it works

- Browser form on the landing page -> `POST https://<api>/api/waitlist` (JSON `{ email, source, locale, website }`) -> D1 table `waitlist`.
- Public route, no sign-in. CORS allows hangulroute.com, www and app (plus localhost and `*.workers.dev` previews while `ALLOWED_ORIGINS` is unset).
- The address is trimmed and lower-cased, checked strictly, and stored once. Signing up again looks identical to the visitor and creates no second row. The reply never contains the address.
- `website` is a hidden trap field. A person never fills it; if it is filled the API answers success and stores nothing.
- Abuse limit: 10 requests per client address per hour, per Worker isolate (same in-memory limiter as `/api/recovery/claim`). It slows a script hammering one location, it is not a hard global cap. If the list ever fills with junk, add Cloudflare Turnstile or a Cloudflare rate-limiting rule on `/api/waitlist` (dashboard, no code).
- Stored per row: address, signup time, `source` (`landing`), `locale`, `consent_text_version` (which consent line they saw), `unsubscribed_at`. No IP address, no user agent. The API writes no logs for this route.

All commands below run from the repository root with the Cloudflare login the API deploys use. Use `--remote` for production.

## See how many signed up

```sh
pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote \
  --command "SELECT COUNT(*) AS active FROM waitlist WHERE unsubscribed_at IS NULL"
```

## Export the list

```sh
pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote --json \
  --command "SELECT email, created_at FROM waitlist WHERE unsubscribed_at IS NULL ORDER BY created_at" \
  > waitlist.json
```

`waitlist.json` holds the rows under `[0].results`. To turn it into a CSV for any mailer's import screen:

```sh
jq -r '.[0].results | (["email","created_at"], (.[] | [.email, .created_at])) | @csv' waitlist.json > waitlist.csv
```

Treat both files as personal data: do not commit them, and delete them once imported.

## Remove an address

A person writes to hello@hangulroute.com (the consent line on the form says so). Use the lower-case address.

Opt-out, keeping a record so they are never re-added by a later signup or import:

```sh
pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote \
  --command "UPDATE waitlist SET unsubscribed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'person@example.com'"
```

Erase completely (use when someone asks for deletion; it also forgets the opt-out):

```sh
pnpm --filter @hangul-route/api exec wrangler d1 execute hangul-route --remote \
  --command "DELETE FROM waitlist WHERE email = 'person@example.com'"
```

Rows with `unsubscribed_at` set are skipped by the export above. A signup form submission never clears `unsubscribed_at`.

## Sending is not built

There is no mailer in this repository. When launch news is ready, import `waitlist.csv` into any email tool (for example Buttondown, MailerLite or Resend broadcasts). Every message needs a working unsubscribe link and the sender's postal address if the tool requires one; when a recipient unsubscribes there, mark the same address here with the `UPDATE` above before the next import.

## Before launch (owner items)

- The privacy policy has a "Launch-news email list" section (what is collected, why, who stores it, how long, how to be removed). It is still a draft pending counsel review, like the rest of `/privacy`.
- The sentence above the form promises launch news only: "Leave your email and we'll send you the launch news." It makes no other offer (no free code, no launch-day claim). Keep it that way unless the owner decides otherwise; `landing-waitlist.test.tsx` pins it.
- Production check after the deploy: submit a real address on https://hangulroute.com, then run the count query above.

## Reference

- API route: `packages/backend/src/routes/waitlist.ts` · migration `apps/api/migrations/0004_waitlist.sql`
- Form: `apps/web/src/components/landing/WaitlistForm.tsx` · transport and copy: `apps/web/src/lib/waitlist.ts`
- The web build needs `NEXT_PUBLIC_API_BASE_URL` (already set for the console). Without it the form tells visitors to email us instead.
