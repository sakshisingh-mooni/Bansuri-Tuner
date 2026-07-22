import { useCallback, useEffect, useRef, useState } from 'react';
import Pitchy, { type PitchyEvent } from 'react-native-pitchy';
import { AudioModule, setAudioModeAsync } from 'expo-audio';

/**
 * Sample rate of pitch events flowing out of this hook. react-native-pitchy
 * benchmarks show YIN at ~1.3ms/call on a 4096-sample buffer @ 44.1kHz
 * (~93ms of audio per frame) — comfortably real-time for sustained-tone
 * tracking, which is what a tuning practice flow actually needs (bansuri
 * phrasing sustains notes for hundreds of ms at minimum).
 */
const MIN_VOLUME_DB = -40; // raised from -55: faint residual/decay noise (speaker
// ring-down, room resonance) was slipping through at the quieter threshold
const MIN_CONFIDENCE = 0.85;

const PITCHY_CONFIG = {
  algorithm: 'YIN' as const,
  bufferSize: 4096,
  minVolume: MIN_VOLUME_DB,
  // Flute tone is clean/harmonic-rich; a moderately high confidence floor
  // avoids breath-noise and key-click transients being reported as pitch.
  minConfidence: MIN_CONFIDENCE,
};

/**
 * Plausible bansuri range: our lowest preset (D3) is 146.83 Hz and the
 * highest (A4) is 440 Hz, with players reasonably reaching up to ~2 octaves
 * above Sa in the upper register. Anything outside this is almost certainly
 * not the flute — electrical hum, HVAC/fan rumble, or room noise commonly
 * lands in the 50-120 Hz range and can otherwise fool a confidence-based
 * gate if it happens to be tonal enough.
 */
const MIN_PLAUSIBLE_HZ = 130;
const MAX_PLAUSIBLE_HZ = 2100;

/**
 * Caps how often we actually push a new React state update, independent of
 * how often the native listener fires. A tuner dial doesn't need to
 * visually update faster than this to look and feel smooth — and without
 * this cap, a burst of native events firing faster than expected can chain
 * through this hook's downstream effects (scoring, trace graph) quickly
 * enough to trip React's "Maximum update depth" safety check.
 */
const MIN_EMIT_INTERVAL_MS = 50; // ~20 UI updates/sec ceiling

export interface PitchSample {
  pitchHz: number;
  confidence: number;
  volumeDb: number;
  /** True capture wall-time (ms), immune to bridge delivery jitter. */
  atMs: number;
}

export type PermissionStatus = 'undetermined' | 'granted' | 'denied';

interface UsePitchDetectorResult {
  isListening: boolean;
  latestSample: PitchSample | null;
  permissionStatus: PermissionStatus;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function usePitchDetector(): UsePitchDetectorResult {
  const [isListening, setIsListening] = useState(false);
  const [latestSample, setLatestSample] = useState<PitchSample | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('undetermined');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  const subscription = useRef<ReturnType<typeof Pitchy.addListener> | null>(null);
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false); // synchronous mirror of isListening, for the idempotency guards below
  const lastEmitMs = useRef(0); // throttling — see MIN_EMIT_INTERVAL_MS below

  const clearIdleTimeout = () => {
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current);
      idleTimeout.current = null;
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await AudioModule.requestRecordingPermissionsAsync();
      const status: PermissionStatus = result.granted ? 'granted' : 'denied';
      setPermissionStatus(status);
      return result.granted;
    } catch (e) {
      setError('Could not request microphone permission.');
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const ensureInit = useCallback(() => {
    if (!initialized.current) {
      try {
        Pitchy.init(PITCHY_CONFIG);
        initialized.current = true;
      } catch (e) {
        setError('Could not initialize the pitch detector.');
      }
    }
  }, []);

  const start = useCallback(async () => {
    // Idempotency guard: calling the native start() again while already
    // recording risks corrupting the underlying Android audio engine
    // (a known class of issue with AudioRecord) — it can end up "running"
    // but silently producing garbage/near-silent data from then on, which
    // matches a listener that keeps firing but never reports a confident
    // pitch. With how often start() gets called across screen focus
    // changes and mode switches, this guard matters a lot in practice.
    if (isListeningRef.current) return;

    setError(null);
    // Clear any leftover reading from a previous listening session — without
    // this, a stale sample can sit displayed on screen even though nothing
    // is currently being captured (looks like a frozen/phantom reading).
    setLatestSample(null);
    lastEmitMs.current = 0;

    let granted = permissionStatus === 'granted';
    if (!granted) {
      granted = await requestPermission();
    }
    if (!granted) {
      setError('Microphone access is needed to detect pitch.');
      return;
    }

    // Explicitly allow recording in the audio session, and let it coexist
    // with playback. Without this, expo-audio's playback module (used for
    // the reference-tone "Play Sa" feature) can leave the session unable to
    // record simultaneously — allowsRecording defaults to false and
    // interruptionMode defaults to 'mixWithOthers', neither of which
    // reliably guarantees the mic stays live once playback is involved.
    try {
      await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'mixWithOthers' });
    } catch (e) {
      // Non-fatal — proceed and let the mic attempt to start regardless.
    }

    ensureInit();

    if (!subscription.current) {
      subscription.current = Pitchy.addListener((event: PitchyEvent) => {
        const isPlausible =
          event.pitch > 0 &&
          event.pitch >= MIN_PLAUSIBLE_HZ &&
          event.pitch <= MAX_PLAUSIBLE_HZ &&
          // Defensive re-check in JS: PITCHY_CONFIG already asks the native
          // side to filter by confidence/volume, but we don't fully control
          // whether that's applied before every emitted event, so checking
          // again here costs nothing and closes that gap either way.
          event.confidence >= MIN_CONFIDENCE &&
          event.volume >= MIN_VOLUME_DB;

        if (isPlausible) {
          const nowMs = event.tCaptureMs ?? Date.now();
          if (nowMs - lastEmitMs.current < MIN_EMIT_INTERVAL_MS) {
            return; // throttled — skip this update, native fired faster than the UI needs
          }
          lastEmitMs.current = nowMs;

          setLatestSample({
            pitchHz: event.pitch,
            confidence: event.confidence,
            volumeDb: event.volume,
            atMs: nowMs,
          });

          // The dial should return to idle shortly after the real source
          // stops, rather than freezing on the last note forever. Each
          // accepted sample pushes this timeout back out; if ~500ms pass
          // with nothing accepted, we clear the reading.
          clearIdleTimeout();
          idleTimeout.current = setTimeout(() => {
            setLatestSample(null);
          }, 500);
        }
      });
    }

    try {
      await Pitchy.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (e) {
      setError('Could not start audio capture.');
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [ensureInit, permissionStatus, requestPermission]);

  const stop = useCallback(async () => {
    // Symmetric idempotency guard — see start() above.
    if (!isListeningRef.current) return;

    clearIdleTimeout();
    try {
      await Pitchy.stop();
    } catch {
      // Pitchy throws "Not recording" if stop() is called when it wasn't
      // actively capturing (e.g. the AppState handler firing before the
      // user ever pressed "Start practicing"). Harmless — treat as a no-op.
    } finally {
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  // NOTE: previously stopped the mic on backgrounding (matching Pano
  // Tuner's behavior) and restarted it on foregrounding. Removed — every
  // genuine stop-then-start cycle we've tested leaves the native mic
  // engine unable to restart properly (see the idempotency-guard comments
  // on start()/stop() above), and backgrounding/foregrounding is common
  // enough in normal use that this was breaking the mic far too often. The
  // JS thread is naturally throttled while the app is backgrounded anyway,
  // so the practical cost of just leaving the native engine running is
  // small compared to the mic silently breaking on the next foreground.

  useEffect(() => {
    return () => {
      subscription.current?.remove();
      subscription.current = null;
      clearIdleTimeout();
      Pitchy.stop().catch(() => {});
    };
  }, []);

  return { isListening, latestSample, permissionStatus, error, requestPermission, start, stop };
}
