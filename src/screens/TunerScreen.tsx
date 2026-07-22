import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { usePitchDetectorContext } from '../audio/PitchDetectorContext';
import { useReferenceTone } from '../audio/useReferenceTone';
import { nearestSwara, freqToCentsFromSa, saptakName, getSwara, type SwaraId } from '../theory/swaras';
import { NoteAttemptTracker } from '../scoring/sessionScorer';
import { useSessionStore } from '../storage/sessionStore';
import { useInTuneTolerance, TOLERANCE_PRESETS } from '../storage/settingsStore';
import { SwaraDial } from '../components/SwaraDial';
import { SubScoreBar } from '../components/SubScoreBar';
import { PitchTraceGraph, type TraceSample } from '../components/PitchTraceGraph';
import { colors, typography, spacing, radii } from '../theme/tokens';
import type { NoteAttempt } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tuner'>;

const TRACE_WINDOW_MS = 3500;

function makeSessionId(): string {
  return `session_${Date.now()}`;
}

export function TunerScreen({ route, navigation }: Props) {
  const { calibration } = route.params;
  const { isListening, latestSample, permissionStatus, start, stop, error } = usePitchDetectorContext();
  const { isPlaying: isTonePlaying, playTone } = useReferenceTone();
  const { toleranceCents, setToleranceCents } = useInTuneTolerance();
  const store = useSessionStore();

  const sessionIdRef = useRef<string>(makeSessionId());
  const trackerRef = useRef(new NoteAttemptTracker(calibration.hz));
  const [lastAttempt, setLastAttempt] = useState<NoteAttempt | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [traceSamples, setTraceSamples] = useState<TraceSample[]>([]);
  const [isBeginning, setIsBeginning] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    trackerRef.current.updateTonic(calibration.hz);
  }, [calibration.hz]);

  const beginSession = async () => {
    if (isBeginning || sessionStarted) return; // guard against double-taps
    setIsBeginning(true);
    setActionError(null);
    try {
      await store.createSession({
        id: sessionIdRef.current,
        instrument: 'bansuri',
        startedAt: new Date().toISOString(),
        tonicHz: calibration.hz,
        tonicSource: calibration.source,
      });
      setSessionStarted(true);
      await start();
    } catch (e) {
      setActionError("Couldn't start the session — try again.");
    } finally {
      setIsBeginning(false);
    }
  };

  const endSessionAndLeave = async () => {
    if (isEnding) return; // guard against double-taps
    setIsEnding(true);
    setActionError(null);
    try {
      const pending = trackerRef.current.flush();
      if (pending) {
        await store.saveAttempt(sessionIdRef.current, pending);
      }
      // Deliberately NOT calling stop() here. Every genuine stop-then-start
      // cycle we've tested has left the native mic engine unable to restart
      // properly (see usePitchDetector's idempotency-guard comments) —
      // ending a session now only means "stop scoring," which the
      // sessionStarted gate on the ingest effect already handles. The mic
      // itself just keeps running for the rest of the app's lifetime.
      await store.endSession(sessionIdRef.current, new Date().toISOString());
      // replace, not navigate: removes this Tuner screen from the stack
      // entirely, so the back button can't return to this now-finished
      // instance (which would otherwise sit frozen showing "Ending…"
      // forever, since nothing resets that state on a screen React
      // Navigation keeps alive in the background rather than destroying).
      navigation.replace('History');
    } catch (e) {
      setActionError("Couldn't save the session cleanly — your notes so far are still stored. Try ending again.");
      setIsEnding(false);
    }
  };

  useEffect(() => {
    if (!latestSample || isTonePlaying || !isListening || !sessionStarted) return;
    const finished = trackerRef.current.ingest(latestSample);
    if (finished) {
      setLastAttempt(finished);
      store.saveAttempt(sessionIdRef.current, finished).catch(() => {});
      const inTune = Math.abs(finished.avgCentsDeviation) <= toleranceCents;
      Haptics.impactAsync(inTune ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Rigid).catch(
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSample, toleranceCents, isTonePlaying, isListening, sessionStarted]);

  const liveReading = useMemo(() => {
    if (!latestSample) return null;
    return nearestSwara(latestSample.pitchHz, calibration.hz);
  }, [latestSample, calibration.hz]);

  // Rolling pitch-trace buffer, trimmed to the visible window on every sample.
  useEffect(() => {
    if (!latestSample || !liveReading) return;
    setTraceSamples((prev) => {
      const next = [...prev, { atMs: latestSample.atMs, deviationCents: liveReading.deviationCents }];
      const cutoff = latestSample.atMs - TRACE_WINDOW_MS;
      return next.filter((s) => s.atMs >= cutoff);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSample]);

  const centsFromSa =
    liveReading && latestSample ? freqToCentsFromSa(latestSample.pitchHz, calibration.hz) : null;

  const registerLabel = liveReading ? saptakName(liveReading.octave) : null;

  const handlePlaySa = () => playTone(calibration.hz);
  const playSwaraById = (swaraId: SwaraId) => {
    const swara = getSwara(swaraId);
    playTone(calibration.hz * Math.pow(2, swara.cents / 1200));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.dialWrap}>
        <SwaraDial
          centsFromSa={centsFromSa}
          nearestSwaraId={liveReading?.swara.id ?? null}
          deviationCents={liveReading?.deviationCents ?? null}
          isListening={isListening}
          toleranceCents={toleranceCents}
          onSwaraPress={playSwaraById}
        />
        <Text style={styles.dialHint}>Tap any note on the dial to hear it</Text>
        <View style={styles.nameRow}>
          <Text style={styles.swaraName}>{liveReading ? liveReading.swara.name : '—'}</Text>
          {registerLabel && isListening ? <Text style={styles.registerBadge}>{registerLabel}</Text> : null}
        </View>
        {liveReading && isListening ? (
          <Text
            style={[
              styles.deviation,
              { color: Math.abs(liveReading.deviationCents) <= toleranceCents ? colors.patina : colors.copper },
            ]}
          >
            {liveReading.deviationCents > 0 ? '+' : ''}
            {liveReading.deviationCents.toFixed(0)}&#162;
          </Text>
        ) : (
          <Text style={styles.deviationIdle}>Sa = {calibration.hz.toFixed(1)} Hz</Text>
        )}
      </View>

      {isListening ? (
        <View style={styles.traceWrap}>
          <PitchTraceGraph samples={traceSamples} toleranceCents={toleranceCents} />
        </View>
      ) : null}

      <View style={styles.toleranceRow}>
        <Text style={styles.toleranceLabel}>In-tune tolerance</Text>
        <View style={styles.toleranceChips}>
          {TOLERANCE_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              style={[styles.toleranceChip, toleranceCents === preset.cents && styles.toleranceChipActive]}
              onPress={() => setToleranceCents(preset.cents)}
            >
              <Text
                style={[
                  styles.toleranceChipText,
                  toleranceCents === preset.cents && styles.toleranceChipTextActive,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.toneRow}>
        <Pressable style={styles.toneButton} onPress={handlePlaySa} disabled={isTonePlaying}>
          <Text style={styles.toneButtonText}>&#9835; Play Sa</Text>
        </Pressable>
      </View>

      {lastAttempt ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreCardTitle}>Last held note — {lastAttempt.displayName}</Text>
          <SubScoreBar label="Pitch" score={lastAttempt.pitchScore} />
          <SubScoreBar label="Stability" score={lastAttempt.stabilityScore} />
          <SubScoreBar label="Breath" score={lastAttempt.breathScore} />
        </View>
      ) : (
        <View style={styles.scoreCardEmpty}>
          <Text style={styles.emptyText}>
            Hold a note steady for at least half a second to get scored — quick passing notes won't count.
          </Text>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {permissionStatus === 'denied' ? (
        <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsButtonText}>Open Settings to allow microphone access</Text>
        </Pressable>
      ) : null}
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      <View style={styles.controls}>
        {!sessionStarted ? (
          <Pressable style={styles.primaryButton} onPress={beginSession} disabled={isBeginning}>
            <Text style={styles.primaryButtonText}>{isBeginning ? 'Starting…' : 'Start practicing'}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={endSessionAndLeave} disabled={isEnding}>
            <Text style={styles.primaryButtonText}>{isEnding ? 'Ending…' : 'End session'}</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('History')}>
          <Text style={styles.secondaryButtonText}>Sessions</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  dialWrap: { alignItems: 'center', marginTop: spacing.md },
  dialHint: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md },
  swaraName: {
    fontFamily: typography.display,
    color: colors.ivory,
    fontSize: 32,
  },
  registerBadge: {
    fontFamily: typography.data,
    color: colors.bambooMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviation: {
    fontFamily: typography.dataBold,
    fontSize: 20,
    marginTop: spacing.xs,
  },
  deviationIdle: {
    fontFamily: typography.data,
    color: colors.tan,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  traceWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  toleranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toleranceLabel: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 13,
  },
  toleranceChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toleranceChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  toleranceChipActive: {
    backgroundColor: colors.bamboo,
    borderColor: colors.bamboo,
  },
  toleranceChipText: {
    fontFamily: typography.bodyMedium,
    color: colors.tan,
    fontSize: 12,
  },
  toleranceChipTextActive: {
    color: colors.ink,
  },
  toneRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toneButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.bambooMuted,
    alignItems: 'center',
  },
  toneButtonText: {
    fontFamily: typography.bodyMedium,
    color: colors.bamboo,
    fontSize: 13,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  scoreCardTitle: {
    fontFamily: typography.bodyMedium,
    color: colors.ivory,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  scoreCardEmpty: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyText: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: typography.body,
    color: colors.copper,
    fontSize: 13,
    textAlign: 'center',
  },
  settingsButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.copper,
  },
  settingsButtonText: {
    fontFamily: typography.bodyMedium,
    color: colors.copper,
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.bamboo,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  stopButton: {
    flex: 1,
    backgroundColor: colors.copper,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.ink,
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: typography.bodyMedium,
    color: colors.tan,
    fontSize: 15,
  },
});
