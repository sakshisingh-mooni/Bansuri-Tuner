import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useSessionStore } from '../storage/sessionStore';
import { SessionCard } from '../components/SessionCard';
import { colors, typography, spacing, radii } from '../theme/tokens';
import type { PracticeSession } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const store = useSessionStore();
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      store
        .getRecentSessions(30)
        .then((rows) => {
          if (!cancelled) setSessions(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleDelete = (sessionId: string) => {
    Alert.alert('Delete this session?', 'This removes the session and its notes for good — can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await store.deleteSession(sessionId);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          } catch (e) {
            Alert.alert("Couldn't delete", 'Something went wrong removing that session — try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      {sessions.length === 0 && !loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyBody}>Practice sessions you complete will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SessionCard session={item} onDelete={handleDelete} />}
          contentContainerStyle={styles.list}
        />
      )}
      <Pressable style={styles.backButton} onPress={() => navigation.navigate('Calibration')}>
        <Text style={styles.backButtonText}>New session</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, padding: spacing.lg },
  list: { paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: {
    fontFamily: typography.display,
    color: colors.ivory,
    fontSize: 22,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontFamily: typography.body,
    color: colors.tan,
    fontSize: 14,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.bamboo,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  backButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.ink,
    fontSize: 15,
  },
});
