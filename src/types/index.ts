import type { SwaraId } from '../theory/swaras';

/**
 * Generic, instrument-agnostic session schema.
 *
 * Kept deliberately generic (an `instrument` field, a scale-degree
 * `label` rather than a bansuri-only field name) so this same shape can
 * hold tabla bol accuracy, sitar swar practice, etc. later — this is the
 * one piece of the app that was worth generalizing up front, per the
 * "iTabla for bansuri" long-term direction. Everything scoring- and
 * audio-specific stays bansuri/swara-specific for now.
 */

export interface NoteAttempt {
  id: string;
  /** Scale-degree label, e.g. swara id "G". Generic string so other
   *  instruments can use their own vocabulary (bol names, sargam, etc). */
  label: string;
  /** Human-readable name at time of recording, e.g. "Shuddh Ga" */
  displayName: string;
  startedAtMs: number;
  durationMs: number;
  /** Mean signed cents deviation from the target swara over the hold. */
  avgCentsDeviation: number;
  pitchScore: number; // 0-100
  stabilityScore: number; // 0-100
  breathScore: number; // 0-100
  sampleCount: number;
}

export interface PracticeSession {
  id: string;
  instrument: 'bansuri'; // extend union when new instruments are added
  startedAt: string; // ISO
  endedAt: string; // ISO
  tonicHz: number; // generalized "Sa" — the tonic reference for this session
  tonicSource: 'preset' | 'detected';
  attempts: NoteAttempt[];
}

export interface SessionSummary {
  sessionId: string;
  attemptCount: number;
  avgPitchScore: number;
  avgStabilityScore: number;
  avgBreathScore: number;
  /** Per-swara average pitch score, for spotting which notes need work. */
  bySwara: Partial<Record<SwaraId, number>>;
}
