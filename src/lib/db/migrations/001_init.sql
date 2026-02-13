CREATE TABLE IF NOT EXISTS symbols (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  asset_class TEXT,
  currency TEXT,
  sector TEXT,
  industry TEXT
);

CREATE TABLE IF NOT EXISTS prices (
  symbol TEXT,
  date TEXT,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  volume REAL,
  PRIMARY KEY (symbol, date)
);

CREATE TABLE IF NOT EXISTS fundamentals (
  symbol TEXT PRIMARY KEY,
  fetched_at TEXT,
  market_cap REAL,
  trailing_pe REAL,
  forward_pe REAL,
  price_to_sales REAL,
  profit_margins REAL,
  revenue_growth REAL,
  earnings_growth REAL,
  dividend_yield REAL,
  beta REAL,
  total_debt REAL,
  total_cash REAL
);

CREATE TABLE IF NOT EXISTS positions (
  symbol TEXT PRIMARY KEY,
  qty REAL,
  avg_cost REAL,
  currency TEXT,
  thesis_tag TEXT,
  time_horizon TEXT,
  thesis TEXT,
  invalidation REAL,
  target REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  added_at TEXT,
  thesis_tag TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  type TEXT,
  symbol TEXT,
  entry_price REAL,
  exit_price REAL,
  qty REAL,
  pnl REAL,
  thesis TEXT,
  invalidation REAL,
  outcome TEXT,
  lesson TEXT
);

CREATE TABLE IF NOT EXISTS ai_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT,
  scope TEXT,
  symbol TEXT,
  input_json TEXT,
  output_md TEXT
);

CREATE TABLE IF NOT EXISTS reddit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  mentions INTEGER NOT NULL,
  sentiment TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  subreddits TEXT NOT NULL
);
