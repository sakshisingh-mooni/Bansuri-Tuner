/**
 * On-the-fly WAV synthesis for the reference-tone feature.
 *
 * Why synthesize instead of bundling audio files: the target frequency is
 * whatever the player's Sa/swara combination works out to, which varies
 * continuously with calibration — there's no fixed set of files to bundle.
 */

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Sine wave at `frequencyHz`, `durationSec` long, with a short linear
 * fade-in/out to avoid audible clicks at the start/end of playback.
 */
export function synthesizeToneWav(frequencyHz: number, durationSec = 1.4): Uint8Array {
  const sampleCount = Math.floor(SAMPLE_RATE * durationSec);
  const fadeSamples = Math.floor(SAMPLE_RATE * 0.03); // 30ms fade
  const dataSize = sampleCount * CHANNELS * (BITS_PER_SAMPLE / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF/WAVE header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), true); // byte rate
  view.setUint16(32, CHANNELS * (BITS_PER_SAMPLE / 8), true); // block align
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const peakAmplitude = 0.5 * 32767; // headroom, avoid a harsh full-scale tone
  for (let i = 0; i < sampleCount; i++) {
    let envelope = 1;
    if (i < fadeSamples) envelope = i / fadeSamples;
    else if (i > sampleCount - fadeSamples) envelope = (sampleCount - i) / fadeSamples;

    const sample = Math.sin((2 * Math.PI * frequencyHz * i) / SAMPLE_RATE) * peakAmplitude * envelope;
    view.setInt16(headerSize + i * 2, Math.round(sample), true);
  }

  return new Uint8Array(buffer);
}
