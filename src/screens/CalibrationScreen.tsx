import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BANSURI_KEY_PRESETS, calibrationFromPreset, calibrationFromDetectedHz } from '../theory/calibration';
import { usePitchDetectorContext } from '../audio/PitchDetectorContext';
import { getLastCalibration, setLastCalibration, type LastCalibration } from '../storage/settingsStore';
import { colors, typography, spacing, radii } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Calibration'>;

export function CalibrationScreen({ navigation }: Props) {
  // Defaults to 'live' rather than 'preset': a guessed key is fine as a
  // fallback, but it can never match a specific flute or a specific
  // recording you're playing along with — "Play my Sa" is the one that
  // actually works without you needing to already know anything.
  const [mode, setMode] = useState<'preset' | 'live'>('live');
  const { isListening, latestSample, permissionStatus, start, stop, error } = usePitchDetectorContext();

  // The hook clears latestSample ~500ms after the source goes quiet — correct
  // for the live tuner dial, but wrong here: calibration needs the reading to
  // stay put after you stop blowing, so there's time to actually tap "Lock
  // this as Sa". This tracks the last steady reading independently, so it
  // survives that clearing.
  const [lastGoodHz, setLastGoodHz] = useState<number | null>(null);

  // Last calibration, so a returning player isn't forced through the full
  // flow every launch — Sa doesn't change between sessions on the same flute.
  const [lastCalibration, setLastCalibrationState] = useState<LastCalibration | null>(null);

  useEffect(() => {
    getLastCalibration().then(setLastCalibrationState);
  }, []);

  useEffect(() => {
    if (latestSample) {
      setLastGoodHz(latestSample.pitchHz);
    }
  }, [latestSample]);

  // Start listening when this screen comes into focus, not just on true
  // first mount (Calibration is the app's root screen, and React Navigation
  // reuses the same instance rather than remounting it on a revisit).
  //
  // Deliberately does NOT stop the mic on blur/cleanup. Repeatedly stopping
  // and restarting the native audio engine on every screen transition
  // appears to leave it in a "zombie" state on some devices — it reports
  // starting successfully and keeps firing events, but stops producing real
  // audio data. Once started, the mic now just keeps running for as long as
  // the app is in the foreground; start() is already idempotent (a no-op if
  // already listening), and the only real stop() calls left are backgrounding
  // (handled in usePitchDetector's AppState listener) and explicitly ending
  // a practice session.
  useFocusEffect(
    useCallback(() => {
      if (mode === 'live') {
        setLastGoodHz(null);
        start();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])
  );

  const handleContinueWithLast = () => {
    if (!lastCalibration) return;
    navigation.navigate('Tuner', {
      calibration: {
        hz: lastCalibration.hz,
        source: lastCalibration.source,
        calibratedAt: lastCalibration.savedAt,
      },
    });
  };

  const handleUsePreset = (presetId: string) => {
    const calibration = calibrationFromPreset(presetId);
    if (calibration) {
      setLastCalibration(calibration.hz, calibration.source);
      navigation.navigate('Tuner', { calibration });
    }
  };

  const handleLockDetected = () => {
    if (lastGoodHz === null) return;
    const calibration = calibrationFromDetectedHz(lastGoodHz);
    setLastCalibration(calibration.hz, calibration.source);
    navigation.navigate('Tuner', { calibration });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {lastCalibration ? (
        <Pressable style={styles.continueCard} onPress={handleContinueWithLast}>
          <View>
            <Text style={styles.continueLabel}>Continue with your last Sa</Text>
            <Text style={styles.continueHz}>{lastCalibration.hz.toFixed(2)} Hz</Text>
          </View>
          <Text style={styles.continueArrow}>&#8594;</Text>
        </Pressable>
      ) : null}

      <Text style={styles.intro}>
        Sa isn't fixed — it depends on your flute. Play your Sa and let the app lock onto it directly (most
        reliable — works for your own flute or for matching a specific recording), or pick a key as a rough
        starting estimate if you'd rather.
      </Text>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, mode === 'live' && styles.toggleButtonActive]}
          onPress={() => setMode('live')}
        >
          <Text style={[styles.toggleText, mode === 'live' && styles.toggleTextActive]}>Play my Sa</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, mode === 'preset' && styles.toggleButtonActive]}
          onPress={() => setMode('preset')}
        >
          <Text style={[styles.toggleText, mode === 'preset' && styles.toggleTextActive]}>Pick my key</Text>
        </Pressable>
      </View>

      {mode === 'preset' && (
        <View style={styles.presetList}>
          {BANSURI_KEY_PRESETS.map((preset) => (
            <Pressable key={preset.id} style={styles.presetRow} onPress={() => handleUsePreset(preset.id)}>
              <Text style={styles.presetNote}>{preset.noteName}</Text>
              <View style={styles.presetTextCol}>
                <Text style={styles.presetHz}>{preset.hz.toFixed(2)} Hz</Text>
                {preset.note ? <Text style={styles.presetDetail}>{preset.note}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {mode === 'live' && (
        <View style={styles.liveWrap}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {permissionStatus === 'denied' ? (
            <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Open Settings to allow microphone access</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.liveHz}>
                {lastGoodHz !== null ? `${lastGoodHz.toFixed(2)} Hz` : isListening ? 'Listening…' : '—'}
              </Text>
              <Text style={styles.liveHint}>
                {lastGoodHz !== null && !latestSample
                  ? 'Holding your last steady reading — play again to update it, or lock it in.'
                  : 'Play a long, steady Sa on your bansuri.'}
              </Text>
              <Pressable
                style={[styles.lockButton, lastGoodHz === null && styles.lockButtonDisabled]}
                onPress={handleLockDetected}
                disabled={lastGoodHz === null}
              >
                <Text style={styles.lockButtonText}>Lock this as Sa</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.bambooMuted,
  },
  continueLabel: {
    fontFamily: typography.bodyMedium,
    color: colors.tan,
    fontSize: 13,
  },
  continueHz: {
    fontFamily: typography.data,
    color: colors.bamboo,
    fontSize: 20,
    marginTop: 2,
  },
  continueArrow: {
    fontFamily: typography.bodyBold,
    color: colors.bamboo,
    fontSize: 20,
  },
  intro: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.bamboo,
  },
  toggleText: {
    fontFamily: typography.bodyMedium,
    color: colors.tan,
    fontSize: 14,
  },
  toggleTextActive: {
    color: colors.ink,
  },
  presetList: {
    gap: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  presetNote: {
    fontFamily: typography.display,
    color: colors.bamboo,
    fontSize: 22,
    width: 64,
  },
  presetTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  presetHz: {
    fontFamily: typography.data,
    color: colors.ivory,
    fontSize: 14,
  },
  presetDetail: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },
  liveWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  liveHz: {
    fontFamily: typography.data,
    color: colors.bamboo,
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  liveHint: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  lockButton: {
    backgroundColor: colors.patina,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  lockButtonDisabled: {
    backgroundColor: colors.hairline,
  },
  lockButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.ink,
    fontSize: 15,
  },
  errorText: {
    fontFamily: typography.body,
    color: colors.copper,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  settingsButton: {
    backgroundColor: colors.surfaceRaised,
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
});
