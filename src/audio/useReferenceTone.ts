import { useCallback, useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { synthesizeToneWav } from './toneSynth';

const TONE_DURATION_SEC = 1.4;

interface UseReferenceToneResult {
  isPlaying: boolean;
  /** Play a pure reference tone at the given frequency. */
  playTone: (hz: number) => Promise<void>;
}

export function useReferenceTone(): UseReferenceToneResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playTone = useCallback(async (hz: number) => {
    try {
      // Defensively reassert that recording stays allowed around playback —
      // we can't fully verify from here whether starting a player silently
      // resets the session's recording permission, and this is cheap
      // insurance against the mic going dead after playing a reference tone.
      try {
        await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'mixWithOthers' });
      } catch {
        // non-fatal
      }

      // Cancel any pending cleanup from a previous tap. Without this, a
      // rapid second tap (e.g. two different notes tapped on the dial in
      // quick succession) leaves the first tone's cleanup timer to fire
      // later — which would both incorrectly clear isPlaying mid-way
      // through the second tone, and try to remove an already-replaced
      // player a second time (which can throw).
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {
          // Already removed/invalid — safe to ignore.
        }
        playerRef.current = null;
      }

      const wavBytes = synthesizeToneWav(hz, TONE_DURATION_SEC);
      const file = new File(Paths.cache, `reference_tone_${Date.now()}.wav`);
      file.create();
      file.write(wavBytes);

      const player = createAudioPlayer(file.uri);
      playerRef.current = player;
      setIsPlaying(true);
      player.play();

      cleanupTimeoutRef.current = setTimeout(() => {
        setIsPlaying(false);
        try {
          player.remove();
        } catch {
          // ignore
        }
        if (playerRef.current === player) playerRef.current = null;
        // Cache file cleanup — best-effort, not critical if it lingers
        // briefly since it's in the OS-managed cache directory.
        try {
          file.delete();
        } catch {
          // ignore
        }
        cleanupTimeoutRef.current = null;
      }, TONE_DURATION_SEC * 1000 + 150);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  return { isPlaying, playTone };
}
