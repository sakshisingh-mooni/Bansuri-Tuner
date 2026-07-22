import { nearestSwara, getSwara, type SwaraId } from '../theory/swaras';
import type { PitchSample } from '../audio/usePitchDetector';
import type { NoteAttempt, SessionSummary } from '../types';
import { scorePitchAccuracy } from './pitchAccuracy';
import { scoreStability } from './stability';
import { scoreBreathConsistency } from './breathConsistency';

/** A note must be held at least this long to count as a scored attempt.
 *  Filters out passing/transitional notes played en route to a target note. */
const MIN_HOLD_MS = 400;

/** Gap in incoming samples longer than this ends the current segment
 *  (player took a breath, stopped, or the mic dropped confidence). */
const GAP_TIMEOUT_MS = 250;

/** First slice of a held note is the attack/settle — pitch and volume
 *  are still stabilizing here, so it's excluded from the sub-scores
 *  rather than penalizing normal note onset. */
const ATTACK_MS = 120;

interface Segment {
  swaraId: SwaraId;
  displayName: string;
  startedAtMs: number;
  lastSampleAtMs: number;
  centsDeviations: number[];
  sampleTimesMs: number[];
  volumesDb: number[];
}

let attemptCounter = 0;
function nextAttemptId(): string {
  attemptCounter += 1;
  return `attempt_${Date.now()}_${attemptCounter}`;
}

function finalizeSegment(segment: Segment): NoteAttempt | null {
  const durationMs = segment.lastSampleAtMs - segment.startedAtMs;
  if (durationMs < MIN_HOLD_MS) return null;

  const settledIndices = segment.sampleTimesMs
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t - segment.startedAtMs >= ATTACK_MS)
    .map(({ i }) => i);

  const useIndices = settledIndices.length >= 2 ? settledIndices : segment.sampleTimesMs.map((_, i) => i);

  const cents = useIndices.map((i) => segment.centsDeviations[i]);
  const volumes = useIndices.map((i) => segment.volumesDb[i]);
  const avgCentsDeviation = cents.reduce((s, c) => s + c, 0) / cents.length;

  return {
    id: nextAttemptId(),
    label: segment.swaraId,
    displayName: segment.displayName,
    startedAtMs: segment.startedAtMs,
    durationMs,
    avgCentsDeviation,
    pitchScore: scorePitchAccuracy(cents),
    stabilityScore: scoreStability(cents),
    breathScore: scoreBreathConsistency(volumes),
    sampleCount: cents.length,
  };
}

/**
 * Stateful segmenter: feed it live pitch samples, get back a finished,
 * scored NoteAttempt whenever a held note ends (swara change, silence
 * gap, or an explicit flush on stop).
 */
export class NoteAttemptTracker {
  private saHz: number;
  private current: Segment | null = null;

  constructor(saHz: number) {
    this.saHz = saHz;
  }

  updateTonic(saHz: number) {
    this.saHz = saHz;
  }

  ingest(sample: PitchSample): NoteAttempt | null {
    const { swara, deviationCents } = nearestSwara(sample.pitchHz, this.saHz);

    if (!this.current) {
      this.current = {
        swaraId: swara.id,
        displayName: swara.name,
        startedAtMs: sample.atMs,
        lastSampleAtMs: sample.atMs,
        centsDeviations: [deviationCents],
        sampleTimesMs: [sample.atMs],
        volumesDb: [sample.volumeDb],
      };
      return null;
    }

    const gap = sample.atMs - this.current.lastSampleAtMs;
    const swaraChanged = swara.id !== this.current.swaraId;

    if (gap > GAP_TIMEOUT_MS || swaraChanged) {
      const finished = finalizeSegment(this.current);
      this.current = {
        swaraId: swara.id,
        displayName: swara.name,
        startedAtMs: sample.atMs,
        lastSampleAtMs: sample.atMs,
        centsDeviations: [deviationCents],
        sampleTimesMs: [sample.atMs],
        volumesDb: [sample.volumeDb],
      };
      return finished;
    }

    this.current.centsDeviations.push(deviationCents);
    this.current.sampleTimesMs.push(sample.atMs);
    this.current.volumesDb.push(sample.volumeDb);
    this.current.lastSampleAtMs = sample.atMs;
    return null;
  }

  /** Call when stopping a session to score whatever note was mid-hold. */
  flush(): NoteAttempt | null {
    if (!this.current) return null;
    const finished = finalizeSegment(this.current);
    this.current = null;
    return finished;
  }
}

export function summarizeAttempts(sessionId: string, attempts: NoteAttempt[]): SessionSummary {
  if (attempts.length === 0) {
    return {
      sessionId,
      attemptCount: 0,
      avgPitchScore: 0,
      avgStabilityScore: 0,
      avgBreathScore: 0,
      bySwara: {},
    };
  }

  const avg = (nums: number[]) => nums.reduce((s, n) => s + n, 0) / nums.length;

  const bySwaraGroups: Partial<Record<SwaraId, number[]>> = {};
  for (const a of attempts) {
    const id = a.label as SwaraId;
    if (!bySwaraGroups[id]) bySwaraGroups[id] = [];
    bySwaraGroups[id]!.push(a.pitchScore);
  }
  const bySwara: Partial<Record<SwaraId, number>> = {};
  for (const [id, scores] of Object.entries(bySwaraGroups)) {
    bySwara[id as SwaraId] = Math.round(avg(scores as number[]));
  }

  return {
    sessionId,
    attemptCount: attempts.length,
    avgPitchScore: Math.round(avg(attempts.map((a) => a.pitchScore))),
    avgStabilityScore: Math.round(avg(attempts.map((a) => a.stabilityScore))),
    avgBreathScore: Math.round(avg(attempts.map((a) => a.breathScore))),
    bySwara,
  };
}
