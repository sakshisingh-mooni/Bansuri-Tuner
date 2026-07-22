import { useCallback } from 'react';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import type { NoteAttempt, PracticeSession, SessionSummary } from '../types';
import { summarizeAttempts } from '../scoring/sessionScorer';

interface SessionRow {
  id: string;
  instrument: string;
  started_at: string;
  ended_at: string | null;
  tonic_hz: number;
  tonic_source: string;
}

interface AttemptRow {
  id: string;
  session_id: string;
  label: string;
  display_name: string;
  started_at_ms: number;
  duration_ms: number;
  avg_cents_deviation: number;
  pitch_score: number;
  stability_score: number;
  breath_score: number;
  sample_count: number;
}

function attemptFromRow(row: AttemptRow): NoteAttempt {
  return {
    id: row.id,
    label: row.label,
    displayName: row.display_name,
    startedAtMs: row.started_at_ms,
    durationMs: row.duration_ms,
    avgCentsDeviation: row.avg_cents_deviation,
    pitchScore: row.pitch_score,
    stabilityScore: row.stability_score,
    breathScore: row.breath_score,
    sampleCount: row.sample_count,
  };
}

export async function createSession(
  db: SQLiteDatabase,
  session: { id: string; instrument: string; startedAt: string; tonicHz: number; tonicSource: string }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sessions (id, instrument, started_at, ended_at, tonic_hz, tonic_source)
     VALUES (?, ?, ?, NULL, ?, ?)`,
    session.id,
    session.instrument,
    session.startedAt,
    session.tonicHz,
    session.tonicSource
  );
}

export async function saveAttempt(
  db: SQLiteDatabase,
  sessionId: string,
  attempt: NoteAttempt
): Promise<void> {
  await db.runAsync(
    `INSERT INTO attempts
      (id, session_id, label, display_name, started_at_ms, duration_ms,
       avg_cents_deviation, pitch_score, stability_score, breath_score, sample_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    attempt.id,
    sessionId,
    attempt.label,
    attempt.displayName,
    attempt.startedAtMs,
    attempt.durationMs,
    attempt.avgCentsDeviation,
    attempt.pitchScore,
    attempt.stabilityScore,
    attempt.breathScore,
    attempt.sampleCount
  );
}

export async function endSession(db: SQLiteDatabase, sessionId: string, endedAt: string): Promise<void> {
  await db.runAsync(`UPDATE sessions SET ended_at = ? WHERE id = ?`, endedAt, sessionId);
}

export async function deleteSession(db: SQLiteDatabase, sessionId: string): Promise<void> {
  // Attempts reference sessions via a foreign key — delete the children first.
  await db.runAsync(`DELETE FROM attempts WHERE session_id = ?`, sessionId);
  await db.runAsync(`DELETE FROM sessions WHERE id = ?`, sessionId);
}

export async function getRecentSessions(db: SQLiteDatabase, limit = 20): Promise<PracticeSession[]> {
  const sessionRows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?`,
    limit
  );

  const sessions: PracticeSession[] = [];
  for (const row of sessionRows) {
    const attemptRows = await db.getAllAsync<AttemptRow>(
      `SELECT * FROM attempts WHERE session_id = ? ORDER BY started_at_ms ASC`,
      row.id
    );
    sessions.push({
      id: row.id,
      instrument: 'bansuri',
      startedAt: row.started_at,
      endedAt: row.ended_at ?? row.started_at,
      tonicHz: row.tonic_hz,
      tonicSource: row.tonic_source as 'preset' | 'detected',
      attempts: attemptRows.map(attemptFromRow),
    });
  }
  return sessions;
}

export async function getSessionSummary(db: SQLiteDatabase, sessionId: string): Promise<SessionSummary> {
  const attemptRows = await db.getAllAsync<AttemptRow>(
    `SELECT * FROM attempts WHERE session_id = ?`,
    sessionId
  );
  return summarizeAttempts(sessionId, attemptRows.map(attemptFromRow));
}

/**
 * React hook wrapper — binds the above functions to the SQLiteContext
 * database so components don't have to thread `db` through everywhere.
 */
export function useSessionStore() {
  const db = useSQLiteContext();

  return {
    createSession: useCallback(
      (session: { id: string; instrument: string; startedAt: string; tonicHz: number; tonicSource: string }) =>
        createSession(db, session),
      [db]
    ),
    saveAttempt: useCallback((sessionId: string, attempt: NoteAttempt) => saveAttempt(db, sessionId, attempt), [db]),
    endSession: useCallback((sessionId: string, endedAt: string) => endSession(db, sessionId, endedAt), [db]),
    deleteSession: useCallback((sessionId: string) => deleteSession(db, sessionId), [db]),
    getRecentSessions: useCallback((limit?: number) => getRecentSessions(db, limit), [db]),
    getSessionSummary: useCallback((sessionId: string) => getSessionSummary(db, sessionId), [db]),
  };
}
