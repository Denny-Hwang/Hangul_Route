# Time zones in unit tests

CI runs on UTC runners. Code that reads the **device-local calendar day**
(`describeRelativeDay` in `packages/i18n/src/format.ts`, `localDay` in
`apps/mobile/src/logic/vocab/progress.ts`) gives a different day for the same
instant in Los Angeles or Seoul. A test that builds "today" from a fixed UTC
instant (`new Date('2026-09-21T03:00:00.000Z')`) is green in CI and red on a
laptop west or east of UTC.

## Rules

- When the code under test reads local calendar days, build the test clock and
  inputs from **local wall-clock times**: `new Date(2026, 8, 21, 12)` for "now",
  `new Date(2026, 8, 21, 3).toISOString()` for an ISO input on the same local day.
  The expectations then hold in every zone.
- When a test needs one exact zone (a rendered date string), pin it with
  `vi.stubEnv('TZ', 'UTC')` **before** anything renders. A `describe` body runs at
  collection time, before `beforeEach`, so pin at module level too.
- Durations (milliseconds between two instants, such as code expiry) do not depend
  on the zone; keep both sides from the same clock. Build a duration input as an
  offset from "now" (`new Date(now.getTime() + 18 * DAY_MS).toISOString()`), or as a
  UTC instant paired with a UTC "now". Never build it from local wall-clock
  constructors: across a DST change (Australia/Sydney starts DST in early October)
  the gap is an hour short and the floored day count drops by one.

## Running the suites in another zone

```sh
TZ=America/Los_Angeles pnpm --filter @hangul-route/web test
TZ=Asia/Seoul pnpm --filter @hangul-route/mobile test
TZ=Australia/Sydney pnpm --filter @hangul-route/web test
TZ=UTC pnpm --filter @hangul-route/web test
```

## Guard

`scripts/__tests__/tz-independence.test.mjs` (part of `pnpm run test:scripts`,
which CI runs) re-runs the files that pin day boundaries under
`America/Los_Angeles`, `Asia/Seoul` and `Australia/Sydney` (DST starts in early
October, inside the fixture windows). Add a file to its `FILES` list when a
test pins a day boundary (relative days, day stamps, due dates).
