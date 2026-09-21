import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: vi.fn(async () => {}),
  readAsStringAsync: vi.fn(async () => '{"hello":1}'),
}));
vi.mock('expo-sharing', () => ({ isAvailableAsync: vi.fn(async () => true), shareAsync: vi.fn(async () => {}) }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { pickTextFile, saveTextFile } from '../file';

describe('platform/file (native)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes to the cache dir and opens the share sheet', async () => {
    expect(await saveTextFile('b.json', '{}')).toEqual({ ok: true });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/b.json', '{}');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/b.json', expect.objectContaining({ mimeType: 'application/json' }));
  });

  it('reports unavailable sharing and failures without throwing', async () => {
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    expect(await saveTextFile('b.json', '{}')).toEqual({ ok: false, reason: 'unavailable' });
    vi.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error('disk'));
    expect(await saveTextFile('b.json', '{}')).toEqual({ ok: false, reason: 'failed' });
  });

  it('picks a document and reads it; canceled and failed are typed', async () => {
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///x.json', name: 'x.json' }] } as never);
    expect(await pickTextFile()).toEqual({ ok: true, name: 'x.json', text: '{"hello":1}' });
    vi.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null } as never);
    expect(await pickTextFile()).toEqual({ ok: false, reason: 'canceled' });
    vi.mocked(DocumentPicker.getDocumentAsync).mockRejectedValueOnce(new Error('nope'));
    expect(await pickTextFile()).toEqual({ ok: false, reason: 'failed' });
  });
});
