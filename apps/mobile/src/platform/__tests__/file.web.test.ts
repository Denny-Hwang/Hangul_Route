import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickTextFile, saveTextFile } from '../file.web';

function fakeDocument() {
  const created: Array<Record<string, unknown> & { click: () => void; remove: () => void }> = [];
  const doc = {
    body: { appendChild: vi.fn() },
    createElement: vi.fn((tag: string) => {
      const el: Record<string, unknown> & { click: () => void; remove: () => void; setAttribute: (k: string, v: string) => void } = {
        tag,
        style: {},
        click: vi.fn(),
        remove: vi.fn(),
        setAttribute: vi.fn(),
      };
      created.push(el);
      return el;
    }),
  };
  return { doc, created };
}

describe('platform/file.web', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saveTextFile downloads through a temporary anchor', async () => {
    const { doc, created } = fakeDocument();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('Blob', class { constructor(public parts: unknown[], public opts: unknown) {} });
    expect(await saveTextFile('b.json', '{}')).toEqual({ ok: true });
    expect(created[0]?.download).toBe('b.json');
    expect(created[0]?.href).toBe('blob:x');
    expect(created[0]?.click).toHaveBeenCalled();
  });

  it('saveTextFile is unavailable without a document', async () => {
    vi.stubGlobal('document', undefined);
    expect(await saveTextFile('b.json', '{}')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('pickTextFile resolves the chosen file text, or canceled', async () => {
    const { doc, created } = fakeDocument();
    vi.stubGlobal('document', doc);
    const p = pickTextFile();
    const input = created[0] as unknown as { files?: Array<{ name: string; text: () => Promise<string> }>; onchange?: () => Promise<void>; oncancel?: () => void };
    input.files = [{ name: 'x.json', text: async () => '{"a":1}' }];
    await input.onchange?.();
    expect(await p).toEqual({ ok: true, name: 'x.json', text: '{"a":1}' });

    const p2 = pickTextFile();
    const input2 = created[1] as unknown as { oncancel?: () => void };
    input2.oncancel?.();
    expect(await p2).toEqual({ ok: false, reason: 'canceled' });

    vi.stubGlobal('document', undefined);
    expect(await pickTextFile()).toEqual({ ok: false, reason: 'failed' });
  });
});
