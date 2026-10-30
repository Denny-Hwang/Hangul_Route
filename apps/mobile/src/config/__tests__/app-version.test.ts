import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AudioSourceSummaryPayloadSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../app-version';

/** The version telemetry carries (`audio.source_summary`, AMENDMENTS-AUDIO-CLIPS AC-B9) is the app's own (app.json). */
describe('APP_VERSION', () => {
  it('is the expo version in app.json', () => {
    const app = JSON.parse(readFileSync(join(__dirname, '../../../app.json'), 'utf8')) as { expo: { version: string } };
    expect(APP_VERSION).toBe(app.expo.version);
  });

  it('fits the summary payload (a dotted version, never free text)', () => {
    expect(AudioSourceSummaryPayloadSchema.shape.appVersion.safeParse(APP_VERSION).success).toBe(true);
  });
});
