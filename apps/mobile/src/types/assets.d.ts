/**
 * Bundled audio clips (F-AUDIO-004 §3.10). Metro turns a clip import into an
 * asset id on iOS and Android and into a URL string on the web build; both are
 * what `Asset.fromModule` and the generated `AUDIO_ASSETS` map hold.
 */
declare module '*.mp3' {
  const asset: number | string;
  export default asset;
}

/**
 * F-AUTH-004 section 7.4, design D12 (row NS-4): the app's splash image, drawn by the account screens' JavaScript cover
 * (`screens/account/AccountCover.tsx`). Metro turns the import into an asset id on iOS and Android.
 */
declare module '*.png' {
  const asset: number | string;
  export default asset;
}
