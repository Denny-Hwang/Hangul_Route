// Amazon Polly, ko-KR Neural engine only (AMENDMENTS-AUDIO-CLIPS AC-B1, AC-B2; row AC-3).
//
// Voices: Seoyeon and Jihye (both female; Polly has no male ko-KR voice). The Generative and Long-form engines are
// refused (AC-B1). The rate goes in SSML <prosody rate>, which the Neural engine supports.
//
// Polly's PCM output stops at 16 kHz, so the 24 kHz master is requested as Ogg Vorbis at 24000 Hz and decoded to a
// mono WAV locally (generate.mjs, ffmpeg). Credentials come only from the AWS SDK's default chain in the environment
// of the one command the owner runs (for example AWS_PROFILE=hr-tts after `aws sso login --profile hr-tts`).
import { GENERATIVE_REASON, VoiceRefused, billedChars, checkRate, ratePercent, ssmlContent } from './shared.mjs';

const VOICES = ['Seoyeon', 'Jihye'];
const GENERATIVE_MODELS = ['generative', 'long-form', 'long_form', 'longform'];

export const polly = Object.freeze({
  id: 'polly',
  vendor: 'aws',
  label: 'Amazon Polly',
  sampleRate: 24000,
  /** The master arrives as Ogg Vorbis and is decoded to WAV locally (ffmpeg), so the run checks the decoder first. */
  needsDecoder: true,
  voices: VOICES,
  pilotVoices: VOICES,
  termsUrl: 'https://aws.amazon.com/service-terms/',
  pricingUrl: 'https://aws.amazon.com/polly/pricing/',

  checkVoice(voice, model) {
    if (model !== undefined && GENERATIVE_MODELS.includes(String(model).toLowerCase())) {
      throw new VoiceRefused(`Polly engine "${model}" ${GENERATIVE_REASON}. Use the Neural engine.`);
    }
    if (model !== undefined && model !== 'neural') {
      throw new VoiceRefused(`Polly engine "${model}" is not allowed: only the Neural engine is used (AC-B1).`);
    }
    if (!VOICES.includes(voice)) {
      throw new VoiceRefused(`Polly voice "${voice}" is not allowed: use ${VOICES.join(' or ')} (ko-KR, Neural engine).`);
    }
  },

  modelOf() {
    return 'neural';
  },

  pricePerMillion() {
    return 16;
  },

  request(row, voice) {
    checkRate(row.rate);
    const text = `<speak><prosody rate="${ratePercent(row.rate)}">${ssmlContent(row)}</prosody></speak>`;
    const payload = {
      Engine: 'neural',
      LanguageCode: 'ko-KR',
      VoiceId: voice,
      OutputFormat: 'ogg_vorbis',
      SampleRate: '24000',
      TextType: 'ssml',
      Text: text,
    };
    return { payload, text, chars: billedChars(text) };
  },

  async createClient({ load = (name) => import(name) } = {}) {
    const { PollyClient, SynthesizeSpeechCommand } = await load('@aws-sdk/client-polly');
    // No credentials or region passed: the SDK's default chain reads them from this command's environment.
    const client = new PollyClient({});
    return {
      async synthesize(payload) {
        const out = await client.send(new SynthesizeSpeechCommand(payload));
        if (!out || !out.AudioStream || typeof out.AudioStream.transformToByteArray !== 'function') {
          throw new Error('Polly returned no audio stream');
        }
        return { bytes: Buffer.from(await out.AudioStream.transformToByteArray()), format: 'ogg' };
      },
    };
  },
});
