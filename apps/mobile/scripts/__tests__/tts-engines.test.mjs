// The speech engine adapters (AMENDMENTS-AUDIO-CLIPS AC-B1, AC-B2, AC-B5; row AC-3): each builds exactly the recorded
// request body (SSML, voice, rate) and hands it unchanged to its vendor SDK client, which is mocked. No network, no
// SDK import, no credential: the SDK loader and fetch are injected.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ENGINES, ENGINE_IDS, GENERATIVE_REASON, VoiceRefused, engineOf } from '../audio/tts/engines/index.mjs';
import { GOOGLE_SCOPE, GOOGLE_SYNTHESIZE_URL } from '../audio/tts/engines/google.mjs';

const FIXTURES = JSON.parse(readFileSync(join(__dirname, '__fixtures__/tts/requests.json'), 'utf8'));
const WAV = Buffer.from('RIFF....WAVEfmt fake');

describe('request bodies match the recorded fixtures', () => {
  it.each(FIXTURES.cases.map((c) => [`${c.engine} ${c.voice} ${c.row}`, c]))('%s', (_name, c) => {
    const engine = ENGINES[c.engine];
    const { payload, text, chars } = engine.request(FIXTURES.rows[c.row], c.voice);
    expect(payload).toEqual(c.payload);
    expect(chars).toBe(c.chars);
    expect([...text].length).toBe(chars);
  });

  it('counts the SSML tags in the billed characters (Polly and Azure wrap every row; Google only an IPA row)', () => {
    const row = FIXTURES.rows['jamo-sound'];
    expect(ENGINES.polly.request(row, 'Seoyeon').chars).toBe('<speak><prosody rate="85%">가.</prosody></speak>'.length);
    expect(ENGINES.google.request(row, 'ko-KR-Neural2-A').chars).toBe(2);
    expect(ENGINES.google.request(FIXTURES.rows.ipa, 'ko-KR-Neural2-A').text).toMatch(/^<speak><phoneme alphabet="ipa"/);
    expect(ENGINES.azure.request(row, 'ko-KR-SunHiNeural').text).toContain('<prosody rate="0.85">가.</prosody>');
  });

  it('escapes text for SSML and refuses a rate outside 0.5-1.5', () => {
    const row = { ...FIXTURES.rows.word, say: '가 & <나>' };
    expect(ENGINES.polly.request(row, 'Seoyeon').text).toContain('가 &amp; &lt;나&gt;');
    expect(() => ENGINES.polly.request({ ...row, rate: 2 }, 'Seoyeon')).toThrow(/outside 0.5-1.5/);
    expect(() => ENGINES.google.request({ ...row, rate: Number.NaN }, 'ko-KR-Neural2-A')).toThrow(/outside/);
  });

  it('declares the master rates of AC-B5: 24 kHz Polly and Google, 48 kHz Azure', () => {
    expect([ENGINES.polly.sampleRate, ENGINES.google.sampleRate, ENGINES.azure.sampleRate]).toEqual([24000, 24000, 48000]);
    expect(ENGINE_IDS).toEqual(['polly', 'google', 'azure']);
    expect(engineOf('openai')).toBeUndefined();
    expect(engineOf('constructor')).toBeUndefined();
  });
});

describe('generative and unlisted voices are refused (AC-B1, under-18 audience)', () => {
  const refused = (engine, voice, model) => {
    try {
      ENGINES[engine].checkVoice(voice, model);
    } catch (e) {
      expect(e).toBeInstanceOf(VoiceRefused);
      return e.message;
    }
    return null;
  };

  it.each([
    ['polly', 'Seoyeon', 'generative'],
    ['polly', 'Jihye', 'long-form'],
    ['google', 'ko-KR-Chirp3-HD-Aoede', undefined],
    ['google', 'ko-KR-Chirp-HD-F', undefined],
    ['google', 'gemini-2.5-flash-tts', undefined],
    ['google', 'ko-KR-Journey-F', undefined],
    ['azure', 'ko-KR-SunHi:DragonHDLatestNeural', undefined],
    ['azure', 'ko-KR-HyunsuHDNeural', undefined],
  ])('%s %s %s is refused as generative', (engine, voice, model) => {
    expect(refused(engine, voice, model)).toContain(GENERATIVE_REASON);
  });

  it.each([
    ['polly', 'Joanna', undefined],
    ['polly', 'Seoyeon', 'standard'],
    ['google', 'ko-KR-Standard-A', undefined],
    ['google', 'ko-KR-Studio-A', undefined],
    ['azure', 'ko-KR-HyunsuMultilingualNeural', undefined],
    ['azure', 'en-US-AvaNeural', undefined],
  ])('%s %s %s is not on the allowed list', (engine, voice, model) => {
    const message = refused(engine, voice, model);
    expect(message).toMatch(/is not allowed/);
    expect(message).not.toContain(GENERATIVE_REASON);
  });

  it('allows the pilot candidates and the documented alternatives', () => {
    for (const [engine, voices] of [
      ['polly', ['Seoyeon', 'Jihye']],
      ['google', ['ko-KR-Neural2-A', 'ko-KR-Neural2-C', 'ko-KR-Wavenet-A']],
      ['azure', ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural']],
    ]) {
      for (const voice of voices) expect(refused(engine, voice, undefined)).toBeNull();
    }
    expect(ENGINES.polly.pilotVoices).toEqual(['Seoyeon', 'Jihye']);
    expect(ENGINES.google.pilotVoices).toEqual(['ko-KR-Neural2-A', 'ko-KR-Neural2-C']);
    expect(ENGINES.google.modelOf('ko-KR-Wavenet-B')).toBe('wavenet');
    expect(ENGINES.google.modelOf('ko-KR-Neural2-C')).toBe('neural2');
  });
});

describe('SDK clients (mocked): the payload goes through unchanged, credentials come from the default chain', () => {
  it('Polly: PollyClient is built with no credentials or region, and SynthesizeSpeechCommand gets the payload', async () => {
    const sent = [];
    class PollyClient {
      constructor(config) {
        this.config = config;
        PollyClient.configs.push(config);
      }
      async send(command) {
        sent.push(command.input);
        return { AudioStream: { transformToByteArray: async () => new Uint8Array([79, 103, 103, 83]) } };
      }
    }
    PollyClient.configs = [];
    class SynthesizeSpeechCommand {
      constructor(input) {
        this.input = input;
      }
    }
    const load = vi.fn(async () => ({ PollyClient, SynthesizeSpeechCommand }));
    const client = await ENGINES.polly.createClient({ load });
    expect(load).toHaveBeenCalledWith('@aws-sdk/client-polly');
    expect(PollyClient.configs).toEqual([{}]);
    const c = FIXTURES.cases.find((x) => x.engine === 'polly');
    const audio = await client.synthesize(ENGINES.polly.request(FIXTURES.rows[c.row], c.voice).payload);
    expect(sent).toEqual([c.payload]);
    expect(audio).toEqual({ bytes: Buffer.from('OggS'), format: 'ogg' });
  });

  it('Polly: no audio stream is an error', async () => {
    class PollyClient {
      async send() {
        return {};
      }
    }
    const client = await ENGINES.polly.createClient({ load: async () => ({ PollyClient, SynthesizeSpeechCommand: class {} }) });
    await expect(client.synthesize({})).rejects.toThrow(/no audio stream/);
  });

  it('Google: GoogleAuth with only the cloud-platform scope (no key file), the REST body posted as recorded', async () => {
    const requests = [];
    const authOptions = [];
    class GoogleAuth {
      constructor(options) {
        authOptions.push(options);
      }
      async getClient() {
        return {
          request: async (req) => {
            requests.push(req);
            return { data: { audioContent: WAV.toString('base64') } };
          },
        };
      }
    }
    const load = vi.fn(async () => ({ GoogleAuth }));
    const client = await ENGINES.google.createClient({ load });
    expect(load).toHaveBeenCalledWith('google-auth-library');
    expect(authOptions).toEqual([{ scopes: [GOOGLE_SCOPE] }]);
    const c = FIXTURES.cases.find((x) => x.engine === 'google' && x.row === 'word');
    const audio = await client.synthesize(ENGINES.google.request(FIXTURES.rows[c.row], c.voice).payload);
    expect(requests).toEqual([{ url: GOOGLE_SYNTHESIZE_URL, method: 'POST', data: c.payload, responseType: 'json' }]);
    expect(audio).toEqual({ bytes: WAV, format: 'wav' });
  });

  it('Google: a response with no audioContent is an error', async () => {
    class GoogleAuth {
      async getClient() {
        return { request: async () => ({ data: {} }) };
      }
    }
    const client = await ENGINES.google.createClient({ load: async () => ({ GoogleAuth }) });
    await expect(client.synthesize({})).rejects.toThrow(/no audioContent/);
  });

  it('Azure: the key and region come from the command environment, the SSML is posted, the key is never in an error', async () => {
    const calls = [];
    const fetch = vi.fn(async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, arrayBuffer: async () => WAV.buffer.slice(WAV.byteOffset, WAV.byteOffset + WAV.length) };
    });
    const env = { AZURE_SPEECH_KEY: 'test-key-not-a-secret', AZURE_SPEECH_REGION: 'koreacentral' };
    const client = await ENGINES.azure.createClient({ env, fetch });
    const c = FIXTURES.cases.find((x) => x.engine === 'azure');
    const audio = await client.synthesize(ENGINES.azure.request(FIXTURES.rows[c.row], c.voice).payload);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://koreacentral.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(calls[0].init.body).toBe(c.payload.ssml);
    expect(calls[0].init.headers['X-Microsoft-OutputFormat']).toBe('riff-48khz-16bit-mono-pcm');
    expect(calls[0].init.headers['Ocp-Apim-Subscription-Key']).toBe(env.AZURE_SPEECH_KEY);
    expect(audio).toEqual({ bytes: WAV, format: 'wav' });

    const failing = await ENGINES.azure.createClient({ env, fetch: async () => ({ ok: false, status: 401 }) });
    const error = await failing.synthesize(c.payload).catch((e) => e);
    expect(error.message).toBe('Azure Speech answered HTTP 401');
    expect(error.message).not.toContain(env.AZURE_SPEECH_KEY);
  });

  it('Azure: refuses to start without the key and region, or with a region that is not an id', async () => {
    const fetch = vi.fn();
    await expect(ENGINES.azure.createClient({ env: {}, fetch })).rejects.toThrow(/AZURE_SPEECH_KEY and AZURE_SPEECH_REGION/);
    await expect(ENGINES.azure.createClient({ env: { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'evil.example.com/' }, fetch })).rejects.toThrow(/region id/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
