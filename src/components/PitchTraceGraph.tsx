import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

const WIDTH = 300;
const HEIGHT = 90;
const CENTS_RANGE = 50; // clamp display to ±50 cents, matching the pitch-score curve's own bound
const WINDOW_MS = 3000; // rolling 3-second trace

export interface TraceSample {
  atMs: number;
  deviationCents: number;
}

interface PitchTraceGraphProps {
  samples: TraceSample[];
  toleranceCents: number;
}

function xFor(atMs: number, nowMs: number): number {
  const age = nowMs - atMs;
  const t = 1 - Math.min(1, Math.max(0, age / WINDOW_MS));
  return t * WIDTH;
}

function yFor(deviationCents: number): number {
  const clamped = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, deviationCents));
  return HEIGHT / 2 - (clamped / CENTS_RANGE) * (HEIGHT / 2);
}

export function PitchTraceGraph({ samples, toleranceCents }: PitchTraceGraphProps) {
  const nowMs = Date.now();
  const visible = samples.filter((s) => nowMs - s.atMs <= WINDOW_MS);

  const points = visible.map((s) => `${xFor(s.atMs, nowMs).toFixed(1)},${yFor(s.deviationCents).toFixed(1)}`).join(' ');

  const bandTopY = yFor(toleranceCents);
  const bandHeight = yFor(-toleranceCents) - bandTopY;

  return (
    <View style={styles.wrap}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {/* In-tune tolerance band, so the trace's context is visible, not just its shape */}
        <Rect x={0} y={bandTopY} width={WIDTH} height={bandHeight} fill={colors.patina} opacity={0.12} />
        <Line x1={0} y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke={colors.hairline} strokeWidth={1} />
        {points.length > 0 && (
          <Polyline points={points} fill="none" stroke={colors.bamboo} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
});
