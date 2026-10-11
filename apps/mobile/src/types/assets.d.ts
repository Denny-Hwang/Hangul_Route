/**
 * Bundled audio clips (F-AUDIO-004 §3.10). Metro turns a clip import into an
 * asset id on iOS and Android and into a URL string on the web build; both are
 * what `Asset.fromModule` and the generated `AUDIO_ASSETS` map hold.
 */
declare module '*.mp3' {
  const asset: number | string;
  export default asset;
}
