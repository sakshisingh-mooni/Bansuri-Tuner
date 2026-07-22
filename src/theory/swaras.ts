/**
 * Hindustani classical swara theory — just intonation.
 *
 * Design decision (confirmed with founder as a statement, not a question):
 * swaras are scored against JUST INTONATION ratios relative to Sa, not
 * equal temperament. This is what "in tune" actually means in this
 * tradition — a pure 3:2 Pa, not a tempered 700-cent Pa.
 *
 * Ratios follow the standard 12-swar just intonation table used in
 * Hindustani theory (5-limit ratios built from small whole numbers).
 * Tivra Ma has more than one convention in circulation; 45/32 is used
 * here as the more common choice. Flagging this as the one debatable
 * pick in the table.
 */

export type SwaraId =
  | 'S'
  | 'r'
  | 'R'
  | 'g'
  | 'G'
  | 'm'
  | 'M'
  | 'P'
  | 'd'
  | 'D'
  | 'n'
  | 'N';

export interface SwaraDefinition {
  id: SwaraId;
  /** Display name, e.g. "Komal Re" */
  name: string;
  /** Short label used in compact UI, e.g. "re" */
  short: string;
  /** Ratio to Sa (1/1) */
  ratio: number;
  /** Cents above Sa, derived from ratio, 0-1200 */
  cents: number;
}

function centsFromRatio(ratio: number): number {
  return 1200 * Math.log2(ratio);
}

function defineSwara(id: SwaraId, name: string, short: string, ratio: number): SwaraDefinition {
  return { id, name, short, ratio, cents: centsFromRatio(ratio) };
}

/** The 12 swaras of the octave, just-intonation ratios from Sa. */
export const SWARAS: SwaraDefinition[] = [
  defineSwara('S', 'Sa', 'Sa', 1 / 1),
  defineSwara('r', 'Komal Re', 're', 16 / 15),
  defineSwara('R', 'Shuddh Re', 'Re', 9 / 8),
  defineSwara('g', 'Komal Ga', 'ga', 6 / 5),
  defineSwara('G', 'Shuddh Ga', 'Ga', 5 / 4),
  defineSwara('m', 'Shuddh Ma', 'ma', 4 / 3),
  defineSwara('M', 'Tivra Ma', 'Ma', 45 / 32),
  defineSwara('P', 'Pa', 'Pa', 3 / 2),
  defineSwara('d', 'Komal Dha', 'dha', 8 / 5),
  defineSwara('D', 'Shuddh Dha', 'Dha', 5 / 3),
  defineSwara('n', 'Komal Ni', 'ni', 9 / 5),
  defineSwara('N', 'Shuddh Ni', 'Ni', 15 / 8),
];

const SWARA_BY_ID: Record<SwaraId, SwaraDefinition> = SWARAS.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<SwaraId, SwaraDefinition>
);

export function getSwara(id: SwaraId): SwaraDefinition {
  return SWARA_BY_ID[id];
}

/**
 * Convert a detected frequency to cents relative to a Sa reference,
 * wrapped into a single octave [0, 1200).
 */
export function freqToCentsFromSa(freqHz: number, saHz: number): number {
  const rawCents = 1200 * Math.log2(freqHz / saHz);
  const wrapped = ((rawCents % 1200) + 1200) % 1200;
  return wrapped;
}

/** Which octave (relative to Sa's octave) the frequency falls in. 0 = same octave as Sa. */
export function octaveFromSa(freqHz: number, saHz: number): number {
  const rawCents = 1200 * Math.log2(freqHz / saHz);
  return Math.floor(rawCents / 1200);
}

export interface NearestSwaraResult {
  swara: SwaraDefinition;
  /** Signed deviation in cents. Positive = sharp, negative = flat. */
  deviationCents: number;
  octave: number;
}

/**
 * Find the closest swara to a detected frequency, handling wraparound
 * at the octave boundary (e.g. a note 10 cents flat of upper Sa should
 * match Sa, not Ni).
 */
export function nearestSwara(freqHz: number, saHz: number): NearestSwaraResult {
  const cents = freqToCentsFromSa(freqHz, saHz);
  const octave = octaveFromSa(freqHz, saHz);

  let best: SwaraDefinition = SWARAS[0];
  let bestDelta = Infinity;

  for (const swara of SWARAS) {
    // Compare against the swara's cents position, and also its position
    // shifted up/down an octave, so we always pick the true nearest
    // neighbor across the 0/1200 seam.
    for (const offset of [-1200, 0, 1200]) {
      const delta = cents - (swara.cents + offset);
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        best = swara;
      }
    }
  }

  return { swara: best, deviationCents: bestDelta, octave };
}

/**
 * Saptak (register) naming. Distinguishing mandra/madhya/taar matters in
 * this tradition the way "which octave" rarely matters for a generic
 * chromatic tuner — the octave data was already being computed
 * (nearestSwara's `octave` field) but wasn't surfaced anywhere in the UI.
 */
export function saptakName(octave: number): string {
  switch (octave) {
    case -2:
      return 'Ati-Mandra';
    case -1:
      return 'Mandra';
    case 0:
      return 'Madhya';
    case 1:
      return 'Taar';
    case 2:
      return 'Ati-Taar';
    default:
      return octave < 0 ? `Mandra ${Math.abs(octave)}\u00d7` : `Taar ${octave}\u00d7`;
  }
}
