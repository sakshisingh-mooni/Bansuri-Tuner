import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../theme/tokens';

interface SubScoreBarProps {
  label: string;
  score: number; // 0-100
  accentColor?: string;
}

export function SubScoreBar({ label, score, accentColor }: SubScoreBarProps) {
  const color = accentColor ?? (score >= 80 ? colors.patina : score >= 50 ? colors.bamboo : colors.copper);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, { color }]}>{Math.round(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    width: 76,
    color: colors.tan,
    fontFamily: typography.body,
    fontSize: 13,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  value: {
    width: 32,
    textAlign: 'right',
    fontFamily: typography.data,
    fontSize: 14,
  },
});
