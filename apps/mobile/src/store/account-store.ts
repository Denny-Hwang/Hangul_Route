import { create } from 'zustand';
import { readJson, writeJson } from '../platform/storage';

/**
 * Family-level account settings, persisted across sessions.
 * Separate from per-child `profile-store`: one parent email + one
 * COPPA consent record covers every child profile on the device.
 */

const EMAIL_KEY = 'account:parentEmail';
const CONSENT_KEY = 'account:consentAcceptedAt';

interface State {
  parentEmail: string | null;
  consentAcceptedAt: string | null;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  setParentEmail: (email: string) => void;
  acceptConsent: () => void;
}

export const useAccountStore = create<State & Actions>((set) => ({
  parentEmail: null,
  consentAcceptedAt: null,
  hydrated: false,

  hydrate: async () => {
    const parentEmail = await readJson<string | null>(EMAIL_KEY);
    const consentAcceptedAt = await readJson<string | null>(CONSENT_KEY);
    set({
      parentEmail: parentEmail ?? null,
      consentAcceptedAt: consentAcceptedAt ?? null,
      hydrated: true,
    });
  },

  setParentEmail: (email) => {
    const value = email.trim() || null;
    set({ parentEmail: value });
    void writeJson(EMAIL_KEY, value);
  },

  acceptConsent: () => {
    const now = new Date().toISOString();
    set({ consentAcceptedAt: now });
    void writeJson(CONSENT_KEY, now);
  },
}));
