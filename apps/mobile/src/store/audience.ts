import { useMessages } from '../i18n/use-messages';
import { audienceCopy, type AudienceCopy } from '../logic/audience-copy';
import { deviceAudience, type DeviceAudience } from '../logic/profiles/learner-type';
import { gateOpensDirectly } from '../logic/profiles/gate-route';
import { useAccountStore } from './account-store';
import { useProfileStore } from './profile-store';

export interface AudienceView {
  audience: DeviceAudience;
  copy: AudienceCopy;
  /** The device has a grown-up PIN (a self-only device may choose to have none, L7). */
  pinSet: boolean;
  /** Whether a grown-up action skips the PIN screen right now (see `gateOpensDirectly`). */
  opensDirectly: (sessionOpen: boolean) => boolean;
}

/** Who this device speaks to (family or self-only), its copy in the UI locale, and what the grown-up gate needs. */
export function useAudience(): AudienceView {
  const messages = useMessages();
  const profiles = useProfileStore((s) => s.profiles);
  const parentPinHash = useAccountStore((s) => s.parentPinHash);
  const audience = deviceAudience(profiles);
  return {
    audience,
    copy: audienceCopy(audience, messages.caregiver.audience),
    pinSet: parentPinHash !== null,
    opensDirectly: (sessionOpen) => gateOpensDirectly({ profiles, parentPinHash, sessionOpen }),
  };
}
