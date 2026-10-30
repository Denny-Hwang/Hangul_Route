// Microsoft Azure Speech, S0 paid tier, standard neural voices only: the fallback (AMENDMENTS-AUDIO-CLIPS AC-B1;
// row AC-3).
//
// Voices: a ko-KR standard neural voice such as ko-KR-SunHiNeural (female) or ko-KR-InJoonNeural (male). HD voices
// (Dragon HD, any name with ":" or "HD") are refused as generative (AC-B1). Output: 48 kHz 16-bit mono RIFF PCM.
// The output right for prebuilt neural voices is for the paid tier only, so the resource must be S0, never the
// free F0 tier (docs/launch/tts-vendor-terms.md).
//
// Azure Speech has no default credential chain for a resource key: the key and region are read from the environment
// of the one command the owner runs (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, set inline, never in a shell profile).
// The key is only ever sent in the request header; it is never printed or written anywhere.
import { GENERATIVE_REASON, VoiceRefused, billedChars, checkRate, ssmlContent } from './shared.mjs';

const STANDARD_NEURAL = /^ko-KR-(?!.*Multilingual)[A-Z][A-Za-z]*Neural$/;
const GENERATIVE = /dragon|hd|:/i;
export const AZURE_OUTPUT_FORMAT = 'riff-48khz-16bit-mono-pcm';

export const azure = Object.freeze({
  id: 'azure',
  vendor: 'azure',
  label: 'Microsoft Azure Speech',
  sampleRate: 48000,
  voices: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
  pilotVoices: ['ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'],
  termsUrl: 'https://www.microsoft.com/licensing/terms/productoffering/MicrosoftAzure/MCA',
  pricingUrl: 'https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/',

  checkVoice(voice, model) {
    if (GENERATIVE.test(String(voice).replace(/^ko-KR-/, '')) || (model !== undefined && GENERATIVE.test(String(model)))) {
      throw new VoiceRefused(`Azure voice "${voice}" ${GENERATIVE_REASON}. Use a standard neural voice such as ko-KR-SunHiNeural.`);
    }
    if (!STANDARD_NEURAL.test(voice)) {
      throw new VoiceRefused(`Azure voice "${voice}" is not allowed: use a ko-KR standard neural voice such as ko-KR-SunHiNeural or ko-KR-InJoonNeural.`);
    }
    if (model !== undefined && model !== 'neural') throw new VoiceRefused(`Azure model "${model}" is not allowed: standard neural only.`);
  },

  modelOf() {
    return 'neural';
  },

  pricePerMillion() {
    return 16;
  },

  request(row, voice) {
    checkRate(row.rate);
    const text =
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">' +
      `<voice name="${voice}"><prosody rate="${row.rate}">${ssmlContent(row)}</prosody></voice></speak>`;
    return { payload: { ssml: text, outputFormat: AZURE_OUTPUT_FORMAT }, text, chars: billedChars(text) };
  },

  async createClient({ env = process.env, fetch: fetchImpl = globalThis.fetch } = {}) {
    const key = env.AZURE_SPEECH_KEY;
    const region = env.AZURE_SPEECH_REGION;
    if (typeof key !== 'string' || key === '' || typeof region !== 'string' || region === '') {
      throw new Error('Azure needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION set inline for this one command (never in a shell profile)');
    }
    if (!/^[a-z0-9]+$/.test(region)) throw new Error('AZURE_SPEECH_REGION must be a region id such as koreacentral');
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    return {
      async synthesize(payload) {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': payload.outputFormat,
            'User-Agent': 'hangul-route-tts',
          },
          body: payload.ssml,
        });
        if (!res.ok) throw new Error(`Azure Speech answered HTTP ${res.status}`);
        return { bytes: Buffer.from(await res.arrayBuffer()), format: 'wav' };
      },
    };
  },
});
