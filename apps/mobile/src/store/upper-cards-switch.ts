/**
 * The `upperCards` switch as the progress store reads it (F-CURR-002 §7.2 and §12.2, row CM-23). The store never
 * imports the remote config (which pulls in the platform), so `store/upper-cards-wiring.ts` registers the reader at
 * start; until then, and in tests that do not register one, the switch reads off.
 */
let read: (profileId: string) => boolean = () => false;

export function setUpperCardsSwitch(reader: (profileId: string) => boolean): void {
  read = reader;
}

export function upperCardsOnFor(profileId: string): boolean {
  return read(profileId);
}
