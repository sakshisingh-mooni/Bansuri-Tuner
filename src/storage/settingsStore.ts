import { useCallback, useEffect, useState } from 'react';
import { Storage } from 'expo-sqlite/kv-store';

/**
 * In-tune tolerance, in cents. Pano Tuner calls this out explicitly:
 * "adjustable tolerance, so 'in tune' means what you need it to mean."
 * We hard-coded 10 cents originally — this makes it a real setting.
 *
 * Deliberately scoped: this only controls the visual/haptic "in tune"
 * threshold (the dial's green-vs-copper cutoff, the haptic ping). It does
 * NOT rescale the underlying 0-100 pitchScore curve in scoring/pitchAccuracy.ts,
 * which stays a fixed, continuous measure — otherwise a player's session
 * history wouldn't be comparable across tolerance settings.
 */
export const TOLERANCE_PRESETS = [
  { id: 'tight', label: 'Tight', cents: 5 },
  { id: 'normal', label: 'Normal', cents: 10 },
  { id: 'relaxed', label: 'Relaxed', cents: 20 },
] as const;

export type TolerancePresetId = (typeof TOLERANCE_PRESETS)[number]['id'];

const SETTINGS_KEY_TOLERANCE = 'settings:in_tune_tolerance_cents';
const DEFAULT_TOLERANCE_CENTS = 10;

export async function getInTuneToleranceCents(): Promise<number> {
  try {
    const raw = await Storage.getItemAsync(SETTINGS_KEY_TOLERANCE);
    if (raw === null) return DEFAULT_TOLERANCE_CENTS;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_TOLERANCE_CENTS;
  } catch {
    return DEFAULT_TOLERANCE_CENTS;
  }
}

export async function setInTuneToleranceCents(cents: number): Promise<void> {
  await Storage.setItemAsync(SETTINGS_KEY_TOLERANCE, String(cents));
}

/** React hook wrapper — loads the persisted tolerance once, exposes a setter. */
export function useInTuneTolerance() {
  const [toleranceCents, setToleranceCentsState] = useState<number>(DEFAULT_TOLERANCE_CENTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getInTuneToleranceCents().then((cents) => {
      if (!cancelled) {
        setToleranceCentsState(cents);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setToleranceCents = useCallback(async (cents: number) => {
    setToleranceCentsState(cents);
    await setInTuneToleranceCents(cents);
  }, []);

  return { toleranceCents, setToleranceCents, loaded };
}

/**
 * Last successful Sa calibration. A player's Sa doesn't change between
 * sessions on the same flute, so re-running full calibration every single
 * app launch is pure friction — this lets the Calibration screen offer a
 * one-tap "continue with your last Sa" shortcut instead of forcing the
 * full flow every time.
 */
const SETTINGS_KEY_LAST_CALIBRATION = 'settings:last_calibration';

export interface LastCalibration {
  hz: number;
  source: 'preset' | 'detected';
  savedAt: string;
}

export async function getLastCalibration(): Promise<LastCalibration | null> {
  try {
    const raw = await Storage.getItemAsync(SETTINGS_KEY_LAST_CALIBRATION);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.hz !== 'number') return null;
    return parsed as LastCalibration;
  } catch {
    return null;
  }
}

export async function setLastCalibration(hz: number, source: 'preset' | 'detected'): Promise<void> {
  const value: LastCalibration = { hz, source, savedAt: new Date().toISOString() };
  await Storage.setItemAsync(SETTINGS_KEY_LAST_CALIBRATION, JSON.stringify(value));
}
