/**
 * Sa reference calibration.
 *
 * Design decision: Sa is NOT fixed. A bansuri's "key" (its construction
 * pitch, e.g. "E bansuri") is conventionally referenced against standard
 * concert pitch (A440 equal temperament) — that's a manufacturing spec,
 * not a scale-degree claim. The just-intonation scoring in swaras.ts is
 * then built on top of whatever Sa the player actually has.
 *
 * Because real flutes vary somewhat from their nominal key (bore length,
 * bamboo, temperature, player's embouchure), the key list below is a
 * convenience starting estimate only. Live calibration (play your Sa,
 * app detects it) is the source of truth and is the recommended flow —
 * the preset just saves a new player from guessing a frequency cold.
 */

export interface BansuriKeyPreset {
  id: string;
  /** Western note name of Sa, e.g. "E4" */
  noteName: string;
  /** Equal-tempered frequency (A4 = 440Hz standard) */
  hz: number;
  /** Human-readable note, from real-world sizing conventions */
  note?: string;
}

// Equal-tempered frequencies, A4 = 440Hz, used only as construction-key
// estimates for common concert and student bansuri sizes.
export const BANSURI_KEY_PRESETS: BansuriKeyPreset[] = [
  { id: 'D3', noteName: 'D3', hz: 146.83, note: 'Bass / deep, meditative — less common' },
  { id: 'E3', noteName: 'E3', hz: 164.81, note: 'Large bass bansuri' },
  { id: 'F3', noteName: 'F3', hz: 174.61 },
  { id: 'G3', noteName: 'G3', hz: 196.0 },
  { id: 'A3', noteName: 'A3', hz: 220.0, note: 'Common beginner size' },
  { id: 'Bb3', noteName: 'Bb3', hz: 233.08 },
  { id: 'C4', noteName: 'C4', hz: 261.63, note: 'Common beginner/medium size' },
  { id: 'D4', noteName: 'D4', hz: 293.66 },
  { id: 'E4', noteName: 'E4', hz: 329.63, note: 'Most common concert bansuri (~90% of players)' },
  { id: 'F4', noteName: 'F4', hz: 349.23, note: 'Concert size, favored for a brighter tone' },
  { id: 'G4', noteName: 'G4', hz: 392.0, note: 'Smaller / brighter' },
  { id: 'A4', noteName: 'A4', hz: 440.0, note: 'Small, high-pitched' },
];

export type CalibrationSource = 'preset' | 'detected';

export interface SaCalibration {
  hz: number;
  source: CalibrationSource;
  presetId?: string;
  calibratedAt: string; // ISO timestamp
}

export function calibrationFromPreset(presetId: string): SaCalibration | null {
  const preset = BANSURI_KEY_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return {
    hz: preset.hz,
    source: 'preset',
    presetId,
    calibratedAt: new Date().toISOString(),
  };
}

export function calibrationFromDetectedHz(hz: number): SaCalibration {
  return {
    hz,
    source: 'detected',
    calibratedAt: new Date().toISOString(),
  };
}
