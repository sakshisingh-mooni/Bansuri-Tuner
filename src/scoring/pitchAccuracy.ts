/**
 * Pitch accuracy sub-score, 0-100, from a sustained-note attempt's cents
 * deviations from its target swara.
 *
 * Scoring curve: linear falloff from 100 (dead on pitch) to 0 at 50 cents
 * off. 50 cents is not an arbitrary round number here — it's the same
 * "within 50 cents of ground truth" threshold the underlying pitch
 * detector's own accuracy benchmark (Raw Pitch Accuracy) uses to define
 * a "correct" detection. Reusing it keeps the tuner's notion of "wrong
 * note" consistent with the detector's own notion of "wrong note".
 */

const FULL_SCORE_CENTS = 0;
const ZERO_SCORE_CENTS = 50;

export function scorePitchAccuracy(centsDeviations: number[]): number {
  if (centsDeviations.length === 0) return 0;

  const meanAbsCents =
    centsDeviations.reduce((sum, c) => sum + Math.abs(c), 0) / centsDeviations.length;

  const t = (meanAbsCents - FULL_SCORE_CENTS) / (ZERO_SCORE_CENTS - FULL_SCORE_CENTS);
  const score = 100 * (1 - t);
  return Math.max(0, Math.min(100, Math.round(score)));
}
