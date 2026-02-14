-- Live Quotes Migration
-- Adds quotes table for caching live price quotes

CREATE TABLE IF NOT EXISTS quotes (
  symbol TEXT PRIMARY KEY,
  fetched_at TEXT,
  price REAL,
  change REAL,
  change_pct REAL,
  source TEXT
);

-- Create index for efficient querying by fetched_at
CREATE INDEX IF NOT EXISTS idx_quotes_fetched_at ON quotes(fetched_at);
