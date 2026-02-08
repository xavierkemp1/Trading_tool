# Database Integration Layer

This directory contains the SQLite database integration for the trading application using sql.js for browser-based persistence.

## Files

- **`database.ts`** - Core database initialization, persistence, and utilities
- **`dbOperations.ts`** - CRUD operations for all database tables
- **`index.ts`** - Convenience exports for easy importing
- **`example.ts`** - Example usage demonstrating the API
- **`migrations/001_init.sql`** - Initial database schema

## Quick Start

```typescript
import { initDatabase, addPosition, getAllPositions } from './lib/db';

// Initialize the database (call once at app startup)
await initDatabase();

// Add a position
await addPosition({
  symbol: 'AAPL',
  qty: 100,
  avg_cost: 150.50,
  currency: 'USD',
  thesis_tag: 'Growth',
  time_horizon: 'Years'
});

// Get all positions
const positions = await getAllPositions();
```

## Database Tables

### symbols
Stores information about trading symbols/tickers
- `symbol` (PRIMARY KEY)
- `name`, `asset_class`, `currency`, `sector`, `industry`

### positions
Tracks current portfolio positions
- `symbol` (PRIMARY KEY)
- `qty`, `avg_cost`, `currency`
- `thesis_tag`, `time_horizon`, `thesis`
- `invalidation`, `target`
- `created_at`, `updated_at`

### watchlist
Symbols being monitored
- `symbol` (PRIMARY KEY)
- `added_at`, `thesis_tag`, `notes`

### prices
Historical price data
- `symbol`, `date` (COMPOSITE PRIMARY KEY)
- `open`, `high`, `low`, `close`, `volume`

### fundamentals
Fundamental data for symbols
- `symbol` (PRIMARY KEY)
- `market_cap`, `trailing_pe`, `forward_pe`, etc.
- `fetched_at`

### journal_entries
Trading journal entries
- `id` (AUTOINCREMENT PRIMARY KEY)
- `created_at`, `type`, `symbol`
- `entry_price`, `exit_price`, `qty`, `pnl`
- `thesis`, `invalidation`, `outcome`, `lesson`

### ai_reviews
AI-generated analysis and reviews
- `id` (AUTOINCREMENT PRIMARY KEY)
- `created_at`, `scope`, `symbol`
- `input_json`, `output_md`

## API Reference

### Database Initialization

```typescript
// Initialize database - loads from localStorage if exists, creates new if not
await initDatabase(): Promise<Database>

// Get database instance (after initialization)
getDatabase(): Database

// Save current state to localStorage
await saveDatabase(): Promise<void>

// Clear database and reset to initial schema
await resetDatabase(): Promise<void>

// Export database as a downloadable file
exportDatabase(): Blob

// Import database from a file
await importDatabase(file: File): Promise<void>
```

### Symbols Operations

```typescript
await upsertSymbol(symbolData: Symbol): Promise<void>
await getSymbol(symbol: string): Promise<Symbol | null>
await getAllSymbols(): Promise<Symbol[]>
```

### Positions Operations

```typescript
await addPosition(position: Omit<Position, 'created_at' | 'updated_at'>): Promise<void>
await updatePosition(symbol: string, updates: Partial<Position>): Promise<void>
await deletePosition(symbol: string): Promise<void>
await getAllPositions(): Promise<Position[]>
await getPositionBySymbol(symbol: string): Promise<Position | null>
```

### Watchlist Operations

```typescript
await addToWatchlist(entry: Omit<WatchlistEntry, 'added_at'>): Promise<void>
await deleteFromWatchlist(symbol: string): Promise<void>
await getAllWatchlist(): Promise<WatchlistEntry[]>
await getWatchlistBySymbol(symbol: string): Promise<WatchlistEntry | null>
```

### Prices Operations

```typescript
await addPrices(prices: Price[]): Promise<void>
await getPricesForSymbol(symbol: string, limit?: number): Promise<Price[]>
await getLatestPrice(symbol: string): Promise<Price | null>
await deletePricesForSymbol(symbol: string): Promise<void>
```

### Fundamentals Operations

```typescript
await upsertFundamentals(data: Fundamentals): Promise<void>
await getFundamentals(symbol: string): Promise<Fundamentals | null>
await deleteFundamentals(symbol: string): Promise<void>
```

### Journal Operations

```typescript
await addJournalEntry(entry: Omit<JournalEntry, 'id'>): Promise<number>
await getAllJournalEntries(limit?: number): Promise<JournalEntry[]>
await getJournalEntriesBySymbol(symbol: string): Promise<JournalEntry[]>
await deleteJournalEntry(id: number): Promise<void>
await updateJournalEntry(id: number, updates: Partial<JournalEntry>): Promise<void>
```

### AI Reviews Operations

```typescript
await addReview(review: Omit<AIReview, 'id'>): Promise<number>
await getReviews(symbol?: string, limit?: number): Promise<AIReview[]>
await deleteReview(id: number): Promise<void>
```

## Persistence

The database automatically persists to `localStorage` under the key `trading_app_db`. The data is stored as a base64-encoded binary blob. 

**Important:** Call `saveDatabase()` after batch operations or when you want to ensure changes are persisted. Most operations automatically call `saveDatabase()` internally.

## Error Handling

All database operations throw errors if they fail. Wrap calls in try-catch blocks:

```typescript
try {
  await addPosition({ ... });
} catch (error) {
  console.error('Failed to add position:', error);
}
```

## TypeScript Types

All operations are fully typed. Import types from `dbOperations.ts`:

```typescript
import type { Position, WatchlistEntry, Price, Fundamentals } from './lib/db';
```

## Notes

- The database must be initialized with `initDatabase()` before any operations
- All timestamps should be in ISO 8601 format (`new Date().toISOString()`)
- The database uses sql.js which runs entirely in the browser
- Data persists across page reloads via localStorage
- For large datasets, consider implementing pagination in queries
