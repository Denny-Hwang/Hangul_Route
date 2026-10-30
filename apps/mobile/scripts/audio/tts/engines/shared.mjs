// What the three speech engines share (AMENDMENTS-AUDIO-CLIPS AC-B1, AC-B2, AC-B5; row AC-3).
//
// An engine module exports one object with the same shape (see engines/index.mjs):
//
//   id, vendor, label           'polly' | 'google' | 'azure' (also the <vendor> of a licence row, licence-rows.mjs),
//                                the company ('aws' | 'google' | 'azure', for a person reading), the name a person reads
//   sampleRate                   the WAV master's rate (24 kHz Google and Polly, 48 kHz Azure)
//   pilotVoices                  the candidate voices the pilot generates when no --voice is given
//   termsUrl, pricingUrl         the pages recorded in docs/launch/tts-vendor-terms.md and in every licence row
//   checkVoice(voice, model?)    throws a refusal for a generative voice or a voice that is not allowed
//   modelOf(voice)               the vendor model id written to the lock ('neural', 'neural2', 'wavenet')
//   pricePerMillion(voice)       US$ per 1M characters after the free allowance (for the dry-run estimate)
//   request(row, voice)          { payload, text, chars }: the exact request body, the text it bills, its count
//   realRunProblem()             optional: why a real run with this engine is refused for now, or null
//   createClient({ env, load, fetch })  lazily imports the vendor SDK; credentials come only from the SDK's own
//                                default chain (for Azure, which has none, the environment of the one command)
//
// A client has one method, synthesize(payload) -> { bytes: Buffer, format: 'wav' | 'ogg' }. The scripts never open
// a key file, never print a credential and never write one to the lock or a report.

/** Why a generative voice is refused, whatever it sounds like (AC-B1, under-18 audience). */
export const GENERATIVE_REASON =
  'is a generative voice. AMENDMENTS-AUDIO-CLIPS AC-B1 excludes generative voices: the app is likely to be used by ' +
  'people under 18, and the vendor terms for generative AI services carry age restrictions';

/** The error a refusal throws: a usage error (exit 2), never a network call. */
export class VoiceRefused extends Error {
  constructor(message) {
    super(message);
    this.name = 'VoiceRefused';
  }
}

/** Escapes text for an SSML document. */
export function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * The characters a request is billed for, counted as the whole text sent, SSML tags included (Unicode code points).
 * Google bills SSML tags other than <mark>; Polly and Azure bill less than this, so for them it is an upper bound,
 * which is what a spend guard needs.
 */
export function billedChars(text) {
  return [...String(text)].length;
}

/** The text inside the SSML: the respelling, or the respelling under an IPA <phoneme> when the override has one. */
export function ssmlContent(row) {
  const say = escapeXml(row.say);
  return typeof row.ipa === 'string' && row.ipa !== '' ? `<phoneme alphabet="ipa" ph="${escapeXml(row.ipa)}">${say}</phoneme>` : say;
}

/** A rate as a percentage for SSML <prosody rate> (0.85 -> "85%"). */
export function ratePercent(rate) {
  return `${Math.round(rate * 100)}%`;
}

/** Throws when a rate is not a plain multiplier in the range the engines accept for this use. */
export function checkRate(rate) {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.5 || rate > 1.5) {
    throw new Error(`rate ${rate} is outside 0.5-1.5 (the manifest gives 0.85-1.0)`);
  }
}
