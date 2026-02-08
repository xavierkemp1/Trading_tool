import { getDatabase, saveDatabase } from './database';
import type { ThesisTag, TimeHorizon } from './types';

// ============= TYPE DEFINITIONS =============

export interface Symbol {
  symbol: string;
  name?: string;
  asset_class?: string;
  currency?: string;
  sector?: string;
  industry?: string;
}

export interface Price {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  symbol: string;
  fetched_at: string;
  market_cap?: number;
  trailing_pe?: number;
  forward_pe?: number;
  price_to_sales?: number;
  profit_margins?: number;
  revenue_growth?: number;
  earnings_growth?: number;
  dividend_yield?: number;
  beta?: number;
  total_debt?: number;
  total_cash?: number;
}

export interface Position {
  symbol: string;
  qty: number;
  avg_cost: number;
  currency?: string;
  thesis_tag?: ThesisTag;
  time_horizon?: TimeHorizon;
  thesis?: string;
  invalidation?: number;
  target?: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistEntry {
  symbol: string;
  added_at: string;
  thesis_tag?: ThesisTag;
  notes?: string;
}

export interface JournalEntry {
  id?: number;
  created_at: string;
  type: 'trade' | 'note' | 'postmortem';
  symbol?: string;
  entry_price?: number;
  exit_price?: number;
  qty?: number;
  pnl?: number;
  thesis?: string;
  invalidation?: number;
  outcome?: string;
  lesson?: string;
}

export interface AIReview {
  id?: number;
  created_at: string;
  scope: string;
  symbol?: string;
  input_json: string;
  output_md: string;
}

// ============= HELPER FUNCTIONS =============

function executeQuery<T>(query: string, params: any[] = []): T[] {
  const db = getDatabase();
  const stmt = db.prepare(query);
  stmt.bind(params);
  
  const results: T[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as T;
    results.push(row);
  }
  stmt.free();
  
  return results;
}

function executeInsert(query: string, params: any[] = []): void {
  const db = getDatabase();
  db.run(query, params);
  saveDatabase();
}

// ============= SYMBOLS =============

export async function upsertSymbol(symbolData: Symbol): Promise<void> {
  const query = `
    INSERT INTO symbols (symbol, name, asset_class, currency, sector, industry)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      name = excluded.name,
      asset_class = excluded.asset_class,
      currency = excluded.currency,
      sector = excluded.sector,
      industry = excluded.industry
  `;
  
  executeInsert(query, [
    symbolData.symbol,
    symbolData.name || null,
    symbolData.asset_class || null,
    symbolData.currency || null,
    symbolData.sector || null,
    symbolData.industry || null
  ]);
}

export async function getSymbol(symbol: string): Promise<Symbol | null> {
  const results = executeQuery<Symbol>(
    'SELECT * FROM symbols WHERE symbol = ?',
    [symbol]
  );
  return results.length > 0 ? results[0] : null;
}

export async function getAllSymbols(): Promise<Symbol[]> {
  return executeQuery<Symbol>('SELECT * FROM symbols ORDER BY symbol');
}

// ============= POSITIONS =============

export async function addPosition(position: Omit<Position, 'created_at' | 'updated_at'>): Promise<void> {
  const now = new Date().toISOString();
  const query = `
    INSERT INTO positions (symbol, qty, avg_cost, currency, thesis_tag, time_horizon, thesis, invalidation, target, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  executeInsert(query, [
    position.symbol,
    position.qty,
    position.avg_cost,
    position.currency || null,
    position.thesis_tag || null,
    position.time_horizon || null,
    position.thesis || null,
    position.invalidation || null,
    position.target || null,
    now,
    now
  ]);
}

export async function updatePosition(symbol: string, updates: Partial<Omit<Position, 'symbol' | 'created_at'>>): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'updated_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  fields.push('updated_at = ?');
  values.push(now);
  values.push(symbol);
  
  const query = `UPDATE positions SET ${fields.join(', ')} WHERE symbol = ?`;
  executeInsert(query, values);
}

export async function deletePosition(symbol: string): Promise<void> {
  executeInsert('DELETE FROM positions WHERE symbol = ?', [symbol]);
}

export async function getAllPositions(): Promise<Position[]> {
  return executeQuery<Position>('SELECT * FROM positions ORDER BY symbol');
}

export async function getPositionBySymbol(symbol: string): Promise<Position | null> {
  const results = executeQuery<Position>(
    'SELECT * FROM positions WHERE symbol = ?',
    [symbol]
  );
  return results.length > 0 ? results[0] : null;
}

// ============= WATCHLIST =============

export async function addToWatchlist(entry: Omit<WatchlistEntry, 'added_at'>): Promise<void> {
  const now = new Date().toISOString();
  const query = `
    INSERT INTO watchlist (symbol, added_at, thesis_tag, notes)
    VALUES (?, ?, ?, ?)
  `;
  
  executeInsert(query, [
    entry.symbol,
    now,
    entry.thesis_tag || null,
    entry.notes || null
  ]);
}

export async function deleteFromWatchlist(symbol: string): Promise<void> {
  executeInsert('DELETE FROM watchlist WHERE symbol = ?', [symbol]);
}

export async function getAllWatchlist(): Promise<WatchlistEntry[]> {
  return executeQuery<WatchlistEntry>('SELECT * FROM watchlist ORDER BY added_at DESC');
}

export async function getWatchlistBySymbol(symbol: string): Promise<WatchlistEntry | null> {
  const results = executeQuery<WatchlistEntry>(
    'SELECT * FROM watchlist WHERE symbol = ?',
    [symbol]
  );
  return results.length > 0 ? results[0] : null;
}

// ============= PRICES =============

export async function addPrices(prices: Price[]): Promise<void> {
  if (prices.length === 0) return;
  
  const db = getDatabase();
  
  // Use a transaction for bulk insert
  db.run('BEGIN TRANSACTION');
  
  try {
    const query = `
      INSERT OR REPLACE INTO prices (symbol, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    prices.forEach(price => {
      db.run(query, [
        price.symbol,
        price.date,
        price.open,
        price.high,
        price.low,
        price.close,
        price.volume
      ]);
    });
    
    db.run('COMMIT');
    saveDatabase();
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

export async function getPricesForSymbol(symbol: string, limit?: number): Promise<Price[]> {
  const query = limit
    ? `SELECT * FROM prices WHERE symbol = ? ORDER BY date DESC LIMIT ?`
    : `SELECT * FROM prices WHERE symbol = ? ORDER BY date DESC`;
  
  const params = limit ? [symbol, limit] : [symbol];
  return executeQuery<Price>(query, params);
}

export async function getLatestPrice(symbol: string): Promise<Price | null> {
  const results = executeQuery<Price>(
    'SELECT * FROM prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
    [symbol]
  );
  return results.length > 0 ? results[0] : null;
}

export async function deletePricesForSymbol(symbol: string): Promise<void> {
  executeInsert('DELETE FROM prices WHERE symbol = ?', [symbol]);
}

// ============= FUNDAMENTALS =============

export async function upsertFundamentals(data: Fundamentals): Promise<void> {
  const query = `
    INSERT INTO fundamentals (
      symbol, fetched_at, market_cap, trailing_pe, forward_pe, price_to_sales,
      profit_margins, revenue_growth, earnings_growth, dividend_yield, beta,
      total_debt, total_cash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      fetched_at = excluded.fetched_at,
      market_cap = excluded.market_cap,
      trailing_pe = excluded.trailing_pe,
      forward_pe = excluded.forward_pe,
      price_to_sales = excluded.price_to_sales,
      profit_margins = excluded.profit_margins,
      revenue_growth = excluded.revenue_growth,
      earnings_growth = excluded.earnings_growth,
      dividend_yield = excluded.dividend_yield,
      beta = excluded.beta,
      total_debt = excluded.total_debt,
      total_cash = excluded.total_cash
  `;
  
  executeInsert(query, [
    data.symbol,
    data.fetched_at,
    data.market_cap || null,
    data.trailing_pe || null,
    data.forward_pe || null,
    data.price_to_sales || null,
    data.profit_margins || null,
    data.revenue_growth || null,
    data.earnings_growth || null,
    data.dividend_yield || null,
    data.beta || null,
    data.total_debt || null,
    data.total_cash || null
  ]);
}

export async function getFundamentals(symbol: string): Promise<Fundamentals | null> {
  const results = executeQuery<Fundamentals>(
    'SELECT * FROM fundamentals WHERE symbol = ?',
    [symbol]
  );
  return results.length > 0 ? results[0] : null;
}

export async function deleteFundamentals(symbol: string): Promise<void> {
  executeInsert('DELETE FROM fundamentals WHERE symbol = ?', [symbol]);
}

// ============= AI REVIEWS =============

export async function addReview(review: Omit<AIReview, 'id'>): Promise<number> {
  const query = `
    INSERT INTO ai_reviews (created_at, scope, symbol, input_json, output_md)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  const db = getDatabase();
  db.run(query, [
    review.created_at,
    review.scope,
    review.symbol || null,
    review.input_json,
    review.output_md
  ]);
  
  // Get the last inserted ID
  const result = executeQuery<{ id: number }>(
    'SELECT last_insert_rowid() as id'
  );
  
  saveDatabase();
  return result[0].id;
}

export async function getReviews(symbol?: string, limit?: number): Promise<AIReview[]> {
  let query = 'SELECT * FROM ai_reviews';
  const params: any[] = [];
  
  if (symbol) {
    query += ' WHERE symbol = ?';
    params.push(symbol);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }
  
  return executeQuery<AIReview>(query, params);
}

export async function deleteReview(id: number): Promise<void> {
  executeInsert('DELETE FROM ai_reviews WHERE id = ?', [id]);
}

// ============= JOURNAL ENTRIES =============

export async function addJournalEntry(entry: Omit<JournalEntry, 'id'>): Promise<number> {
  const query = `
    INSERT INTO journal_entries (
      created_at, type, symbol, entry_price, exit_price, qty, pnl,
      thesis, invalidation, outcome, lesson
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const db = getDatabase();
  db.run(query, [
    entry.created_at,
    entry.type,
    entry.symbol || null,
    entry.entry_price || null,
    entry.exit_price || null,
    entry.qty || null,
    entry.pnl || null,
    entry.thesis || null,
    entry.invalidation || null,
    entry.outcome || null,
    entry.lesson || null
  ]);
  
  // Get the last inserted ID
  const result = executeQuery<{ id: number }>(
    'SELECT last_insert_rowid() as id'
  );
  
  saveDatabase();
  return result[0].id;
}

export async function getAllJournalEntries(limit?: number): Promise<JournalEntry[]> {
  const query = limit
    ? 'SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM journal_entries ORDER BY created_at DESC';
  
  const params = limit ? [limit] : [];
  return executeQuery<JournalEntry>(query, params);
}

export async function getJournalEntriesBySymbol(symbol: string): Promise<JournalEntry[]> {
  return executeQuery<JournalEntry>(
    'SELECT * FROM journal_entries WHERE symbol = ? ORDER BY created_at DESC',
    [symbol]
  );
}

export async function deleteJournalEntry(id: number): Promise<void> {
  executeInsert('DELETE FROM journal_entries WHERE id = ?', [id]);
}

export async function updateJournalEntry(id: number, updates: Partial<Omit<JournalEntry, 'id'>>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  
  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });
  
  values.push(id);
  
  const query = `UPDATE journal_entries SET ${fields.join(', ')} WHERE id = ?`;
  executeInsert(query, values);
}
