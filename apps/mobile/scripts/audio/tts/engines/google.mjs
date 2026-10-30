// Google Cloud Text-to-Speech, ko-KR Neural2 (WaveNet as the alternative) (AMENDMENTS-AUDIO-CLIPS AC-B1, AC-B2;
// row AC-3).
//
// Voices: ko-KR-Neural2-A (female), -B (female), -C (male); ko-KR-Wavenet-A to -D. Chirp 3 HD, Chirp HD, Journey
// and Gemini-TTS voices are refused: Google's Service Specific Terms section 20(d) bars a Generative AI Service from
// a service likely to be used by people under 18 (AC-B1).
//
// The request is the REST `text:synthesize` body: plain text with `audioConfig.speakingRate`, or SSML only when an
// override carries IPA. LINEAR16 at 24000 Hz comes back as a WAV file. Credentials come only from Google's
// Application Default Credentials in the environment of the one command (`gcloud auth application-default login`
// with a quota project; no key file).
import { GENERATIVE_REASON, VoiceRefused, billedChars, checkRate, escapeXml } from './shared.mjs';

const NEURAL2 = /^ko-KR-Neural2-[A-C]$/;
const WAVENET = /^ko-KR-Wavenet-[A-D]$/;
const GENERATIVE = /chirp|gemini|journey/i;
export const GOOGLE_SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const modelOf = (voice) => (WAVENET.test(voice) ? 'wavenet' : 'neural2');

export const google = Object.freeze({
  id: 'google',
  vendor: 'google',
  label: 'Google Cloud Text-to-Speech',
  sampleRate: 24000,
  voices: ['ko-KR-Neural2-A', 'ko-KR-Neural2-B', 'ko-KR-Neural2-C', 'ko-KR-Wavenet-A', 'ko-KR-Wavenet-B', 'ko-KR-Wavenet-C', 'ko-KR-Wavenet-D'],
  pilotVoices: ['ko-KR-Neural2-A', 'ko-KR-Neural2-C'],
  termsUrl: 'https://cloud.google.com/terms/service-terms',
  pricingUrl: 'https://cloud.google.com/text-to-speech/pricing',

  checkVoice(voice, model) {
    if (GENERATIVE.test(String(voice)) || (model !== undefined && GENERATIVE.test(String(model)))) {
      throw new VoiceRefused(`Google voice "${voice}" ${GENERATIVE_REASON}. Use ko-KR-Neural2-A or -C (or WaveNet).`);
    }
    if (!NEURAL2.test(voice) && !WAVENET.test(voice)) {
      throw new VoiceRefused(`Google voice "${voice}" is not allowed: use ko-KR-Neural2-A to -C or ko-KR-Wavenet-A to -D.`);
    }
    if (model !== undefined && model !== modelOf(voice)) {
      throw new VoiceRefused(`Google model "${model}" does not match voice ${voice} (${modelOf(voice)}).`);
    }
  },

  modelOf,

  pricePerMillion(voice) {
    return WAVENET.test(voice) ? 4 : 16;
  },

  request(row, voice) {
    checkRate(row.rate);
    const ipa = typeof row.ipa === 'string' && row.ipa !== '';
    const input = ipa
      ? { ssml: `<speak><phoneme alphabet="ipa" ph="${escapeXml(row.ipa)}">${escapeXml(row.say)}</phoneme></speak>` }
      : { text: row.say };
    const payload = {
      input,
      voice: { languageCode: 'ko-KR', name: voice },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000, speakingRate: row.rate },
    };
    const text = input.ssml ?? input.text;
    return { payload, text, chars: billedChars(text) };
  },

  async createClient({ load = (name) => import(name) } = {}) {
    const { GoogleAuth } = await load('google-auth-library');
    // Application Default Credentials only: no keyFile, no credentials object. The quota project set with
    // `gcloud auth application-default set-quota-project` is sent by the library.
    const auth = new GoogleAuth({ scopes: [GOOGLE_SCOPE] });
    const client = await auth.getClient();
    return {
      async synthesize(payload) {
        const res = await client.request({ url: GOOGLE_SYNTHESIZE_URL, method: 'POST', data: payload, responseType: 'json' });
        const audio = res && res.data ? res.data.audioContent : undefined;
        if (typeof audio !== 'string' || audio === '') throw new Error('Google Text-to-Speech returned no audioContent');
        return { bytes: Buffer.from(audio, 'base64'), format: 'wav' };
      },
    };
  },
});
