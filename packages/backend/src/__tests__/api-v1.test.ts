import { describe, expect, it } from 'vitest';
import app from '../index';

describe('apps/api v1 router', () => {
  it('returns the content catalogs', async () => {
    const stages = await app.request('/api/content/stages');
    const themes = await app.request('/api/content/themes');
    const jamo = await app.request('/api/content/jamo');
    expect(stages.status).toBe(200);
    expect(themes.status).toBe(200);
    expect(jamo.status).toBe(200);
  });

  it('returns the card catalog', async () => {
    const res = await app.request('/api/cards/catalog');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { cards: Array<{ id: string }> } };
    expect(body.data.cards.length).toBeGreaterThanOrEqual(5);
  });

  it('unknown routes return 404 envelope', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
