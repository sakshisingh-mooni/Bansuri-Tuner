import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { PracticeSession } from '../types';
import { colors, typography, spacing, radii } from '../theme/tokens';

interface SessionCardProps {
  session: PracticeSession;
  onDelete?: (sessionId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.max(1, Math.round(ms / 60000));
  return `${mins} min`;
}

export function SessionCard({ session, onDelete }: SessionCardProps) {
  const avgPitch =
    session.attempts.length > 0
      ? Math.round(session.attempts.reduce((s, a) => s + a.pitchScore, 0) / session.attempts.length)
      : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>{formatDate(session.startedAt)}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.duration}>{formatDuration(session.startedAt, session.endedAt)}</Text>
          {onDelete ? (
            <Pressable
              style={styles.deleteButton}
              onPress={() => onDelete(session.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.attemptCount}>{session.attempts.length} notes held</Text>
        <Text style={[styles.avgScore, { color: avgPitch >= 80 ? colors.patina : colors.bamboo }]}>
          {avgPitch}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteButton: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  deleteButtonText: {
    fontFamily: typography.body,
    color: colors.copper,
    fontSize: 12,
  },
  date: {
    fontFamily: typography.bodyMedium,
    color: colors.ivory,
    fontSize: 15,
  },
  duration: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  attemptCount: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 13,
  },
  avgScore: {
    fontFamily: typography.dataBold,
    fontSize: 22,
  },
});
