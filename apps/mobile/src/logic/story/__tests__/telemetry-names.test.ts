import { TELEMETRY_EVENT_NAMES, isTelemetryEventName } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

// F-STORY-002 §3.12 / §5: the reader's three names are on the shared list the Worker
// whitelists, so `track()` accepts them and POST /api/telemetry does not answer 422.
describe('story reader telemetry names', () => {
  it.each(['story.read.finished', 'story.sources.opened', 'story.sources.link_opened'])('%s is whitelisted', (name) => {
    expect(TELEMETRY_EVENT_NAMES).toContain(name);
    expect(isTelemetryEventName(name)).toBe(true);
  });
});

// F-STORY-003 §3.9 / PR 3.4a: the check step's two names shipped with PR 3.1, so the Worker that
// is live already accepts them (Worker first; an unknown name would answer 422 and be dropped).
describe('story check telemetry names', () => {
  it.each(['story.check.answered', 'story.check.finished'])('%s is whitelisted', (name) => {
    expect(TELEMETRY_EVENT_NAMES).toContain(name);
    expect(isTelemetryEventName(name)).toBe(true);
  });
});
