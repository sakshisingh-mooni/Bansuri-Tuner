import React, { createContext, useContext } from 'react';
import { usePitchDetector as usePitchDetectorImpl } from './usePitchDetector';

type PitchDetectorContextValue = ReturnType<typeof usePitchDetectorImpl>;

const PitchDetectorContext = createContext<PitchDetectorContextValue | null>(null);

/**
 * There is exactly one microphone and one native pitch-detection engine for
 * the whole app, so usePitchDetector() must only ever be called ONCE — here.
 * Screens consume it via usePitchDetectorContext() below, not by calling the
 * raw hook directly.
 *
 * Why this matters: React Navigation's native-stack keeps previous screens
 * mounted in the background rather than destroying them when you navigate
 * forward. If each screen called usePitchDetector() independently, each
 * would register its own native listener on the same underlying
 * react-native-pitchy singleton — and navigating back and forth (e.g.
 * Calibration -> Tuner -> Calibration a few times) would leave multiple
 * duplicate listeners alive at once, all firing on every single audio
 * frame. Enough of those firing near-simultaneously is what was tripping
 * React's "Maximum update depth exceeded" safety check.
 */
export function PitchDetectorProvider({ children }: { children: React.ReactNode }) {
  const value = usePitchDetectorImpl();
  return <PitchDetectorContext.Provider value={value}>{children}</PitchDetectorContext.Provider>;
}

export function usePitchDetectorContext(): PitchDetectorContextValue {
  const ctx = useContext(PitchDetectorContext);
  if (!ctx) {
    throw new Error('usePitchDetectorContext must be used within a PitchDetectorProvider');
  }
  return ctx;
}
