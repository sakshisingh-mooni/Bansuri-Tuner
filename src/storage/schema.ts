export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  instrument TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tonic_hz REAL NOT NULL,
  tonic_source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  label TEXT NOT NULL,
  display_name TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  avg_cents_deviation REAL NOT NULL,
  pitch_score INTEGER NOT NULL,
  stability_score INTEGER NOT NULL,
  breath_score INTEGER NOT NULL,
  sample_count INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
`;

export const DATABASE_NAME = 'practice_sessions.db';
