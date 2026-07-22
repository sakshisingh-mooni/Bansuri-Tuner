/**
 * Stability sub-score, 0-100: how steady the pitch stayed once a note
 * was sustained, independent of whether it was sustained on-pitch.
 *
 * Deliberately scored separately from pitch accuracy (see conversation
 * decision: three sub-scores, not one blended number) so a player can
 * tell WHAT to fix — e.g. "your pitch is centered but wavering" reads
 * very differently from "your pitch is just flat."
 *
 * Important scope limit: this function should only ever be called on
 * samples already identified as belonging to a single sustained-note
 * segment (see sessionScorer.ts's segmentation, which requires a
 * continuous hold on one swara). Meend (glides) and andolan (an
 * intentional slow oscillation used as ornamentation) are real
 * technique, not instability — they get segmented out or smoothed over
 * by the segmenter rather than scored here as "unstable."
 */

const PERFECT_STDEV_CENTS = 3;
const WORST_STDEV_CENTS = 25;

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function scoreStability(centsDeviations: number[]): number {
  if (centsDeviations.length < 2) return 100; // too short to judge wobble; don't punish

  const stdev = standardDeviation(centsDeviations);
  const t = (stdev - PERFECT_STDEV_CENTS) / (WORST_STDEV_CENTS - PERFECT_STDEV_CENTS);
  const score = 100 * (1 - t);
  return Math.max(0, Math.min(100, Math.round(score)));
}
