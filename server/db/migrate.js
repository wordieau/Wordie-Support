require('dotenv').config();
const pool = require('../db');

const schema = `
CREATE TABLE IF NOT EXISTS tickets (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  owner_id        TEXT,
  estimate_hours  FLOAT,
  start_date      DATE,
  due_date        DATE,
  pipeline_stage  TEXT,
  allocation_type TEXT CHECK (allocation_type IN ('SOFT','HARD')),
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_allocations (
  id              SERIAL PRIMARY KEY,
  ticket_id       TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  date            DATE NOT NULL,
  planned_hours   FLOAT NOT NULL,
  is_override     BOOLEAN DEFAULT FALSE,
  UNIQUE(ticket_id, user_id, date)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  user_id         TEXT NOT NULL,
  date            DATE NOT NULL,
  actual_hours    FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_capacity (
  user_id         TEXT PRIMARY KEY,
  name            TEXT,
  email           TEXT,
  avatar_url      TEXT,
  weekly_hours    FLOAT DEFAULT 40,
  working_days    TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_user_date ON daily_allocations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_allocations_ticket    ON daily_allocations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_date     ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_ticket        ON time_entries(ticket_id);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log('✓ Database schema applied successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
