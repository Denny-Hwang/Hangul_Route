import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reduced motion preference — honored by all animations.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      if (mounted) setReduced(value);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
