import type { PlacementSource } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { addTelemetryListener, type TelemetryEvent } from '../platform/telemetry';

/**
 * End-to-end entry to the level check, for fixture builds only (the same
 * switch as `story-e2e.tsx`: only the e2e bundle has story fixture ids, so a
 * real build never renders this hook). The learner entry points (F-PLC-001
 * P-7: the onboarding fork, the Home card, the Profile row) stay hidden while
 * `flags.placementEnabled` is off, so its screen e2e opens the check through
 * `window.__hrPlacementE2E.open(source)`.
 */
export interface PlacementE2eHandle {
  open(source: PlacementSource): void;
  /** `placement.*` telemetry events `track()` accepted since the hook mounted. */
  events(): TelemetryEvent[];
}

export function PlacementE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrPlacementE2E?: PlacementE2eHandle };
    const events: TelemetryEvent[] = [];
    const stopListening = addTelemetryListener((e) => {
      if (e.name.startsWith('placement.')) events.push(e);
    });
    g.__hrPlacementE2E = {
      open: (source) => navigation.navigate('Placement', { source }),
      events: () => events.map((e) => ({ ...e })),
    };
    return () => {
      stopListening();
      delete g.__hrPlacementE2E;
    };
  }, [navigation]);
  return null;
}
