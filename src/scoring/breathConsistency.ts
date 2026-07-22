/**
 * Breath consistency sub-score, 0-100.
 *
 * Honest limitation: there is no direct airflow/breath-pressure sensor
 * here. This is a proxy — it scores how flat the loudness envelope (dB)
 * stayed during a sustained note. A player running out of breath support
 * typically shows up as a volume sag or a shaky envelope even when pitch
 * holds steady, so amplitude stability is a reasonable stand-in, but it
 * is not literally measuring breath. Worth surfacing to the founder
 * rather than silently presenting it as a physiological measurement.
 */

const PERFECT_STDEV_DB = 1.5;
const WORST_STDEV_DB = 8;

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function scoreBreathConsistency(volumesDb: number[]): number {
  if (volumesDb.length < 2) return 100;

  const stdev = standardDeviation(volumesDb);
  const t = (stdev - PERFECT_STDEV_DB) / (WORST_STDEV_DB - PERFECT_STDEV_DB);
  const score = 100 * (1 - t);
  return Math.max(0, Math.min(100, Math.round(score)));
}
